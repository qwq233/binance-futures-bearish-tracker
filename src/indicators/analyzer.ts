/**
 * 分析模块
 *
 * 处理各种技术指标分析和信号检测
 */

import { fetchCandles } from '../api/binance.ts';
import { AnalysisResult, Signal, GainerInfo, Candle } from '../models/types.ts';
import { logInfo, logWarning } from '../utils/helpers.ts';
import {
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateMovingAverages,
} from './technical.ts';

/**
 * 分析多个币种的技术指标和反转信号
 *
 * @param symbols 币种列表或部分信息
 * @param interval K 线时间间隔
 * @returns 分析结果列表
 */
export async function analyzeSymbols(
  symbols: Array<GainerInfo | { symbol: string; lastPrice: number }>,
  interval = '1h'
): Promise<AnalysisResult[]> {
  const results: AnalysisResult[] = [];

  for (const symbolInfo of symbols) {
    try {
      const candles = await fetchCandles(symbolInfo.symbol, interval, 100);

      if (candles.length < 30) {
        logWarning(`${symbolInfo.symbol} 历史数据不足，跳过分析`);
        continue;
      }

      const result = analyzeSymbol(symbolInfo.symbol, candles);

      // 设置当前价格
      result.price = symbolInfo.lastPrice;

      results.push(result);
    } catch (error) {
      logWarning(`分析 ${symbolInfo.symbol} 时出错: ${error}`);
    }
  }

  return results;
}

/**
 * 分析单个币种并检测反转信号
 *
 * @param symbol 币种符号
 * @param candles K 线数据
 * @returns 分析结果
 */
export function analyzeSymbol(
  symbol: string,
  candles: Candle[]
): AnalysisResult {
  const result: AnalysisResult = {
    symbol,
    signals: [],
    probability: 0,
    price: candles[candles.length - 1].close,
    timestamp: Date.now(),
    timeframe: '1h',
  };

  // 计算各种技术指标
  const rsi = calculateRSI(candles);
  const { upper, middle, lower } = calculateBollingerBands(candles);
  const macd = calculateMACD(candles);
  const { ma20, ma50, ma200 } = calculateMovingAverages(candles);

  const lastCandle = candles[candles.length - 1];
  const lastIndex = candles.length - 1;

  // 检测各种反转信号
  let totalWeight = 0;
  const signals: Signal[] = [];

  // 1. RSI 超买信号
  if (rsi[lastIndex] > 70) {
    const strength = Math.min(100, (rsi[lastIndex] - 70) * 3.33);
    signals.push({
      name: 'RSI 超买',
      description: `RSI(14) = ${rsi[lastIndex].toFixed(2)}，超过 70 的超买区域`,
      strength,
    });
    totalWeight += strength;
  }

  // 2. 价格接近布林带上轨
  const priceToUpperRatio =
    (lastCandle.close - middle[lastIndex]) /
    (upper[lastIndex] - middle[lastIndex]);
  if (priceToUpperRatio > 0.8) {
    const strength = Math.min(100, priceToUpperRatio * 100);
    signals.push({
      name: '接近布林带上轨',
      description: `价格处于布林带上方 ${(priceToUpperRatio * 100).toFixed(
        2
      )}% 位置`,
      strength,
    });
    totalWeight += strength;
  }

  // 3. MACD 死叉信号
  if (
    macd.MACD[lastIndex] < macd.signal[lastIndex] &&
    macd.MACD[lastIndex - 1] > macd.signal[lastIndex - 1]
  ) {
    signals.push({
      name: 'MACD 死叉',
      description: 'MACD 线下穿信号线，表明动能减弱',
      strength: 90,
    });
    totalWeight += 90;
  }

  // 4. 移动平均线死叉
  if (
    ma20[lastIndex] < ma50[lastIndex] &&
    ma20[lastIndex - 1] > ma50[lastIndex - 1]
  ) {
    signals.push({
      name: '均线死叉',
      description: '20 日均线下穿 50 日均线，形成死叉',
      strength: 85,
    });
    totalWeight += 85;
  }

  // 5. 价格跌破重要支撑位 (MA200)
  if (
    lastCandle.close < ma200[lastIndex] &&
    candles[lastIndex - 1].close > ma200[lastIndex - 1]
  ) {
    signals.push({
      name: '跌破长期支撑',
      description: '价格跌破 200 日均线支撑位',
      strength: 80,
    });
    totalWeight += 80;
  }

  // 6. 量价分析（放量滞涨或缩量上涨）
  if (
    lastCandle.volume > candles[lastIndex - 1].volume * 1.5 &&
    lastCandle.close <= candles[lastIndex - 1].close * 1.01
  ) {
    signals.push({
      name: '放量滞涨',
      description: '成交量增加 50% 以上，但价格涨幅不足 1%',
      strength: 75,
    });
    totalWeight += 75;
  }

  // 计算反转概率
  if (signals.length > 0) {
    // 基于信号数量和强度计算概率
    result.probability = Math.min(
      100,
      (totalWeight / (signals.length * 100)) * 100
    );

    if (signals.length >= 2) {
      // 多重信号共振，提高概率
      result.probability = Math.min(100, result.probability * 1.2);
    }

    result.signals = signals;
    logInfo(
      `${symbol} 检测到 ${
        signals.length
      } 个反转信号，总概率: ${result.probability.toFixed(2)}%`
    );
  }

  return result;
}
