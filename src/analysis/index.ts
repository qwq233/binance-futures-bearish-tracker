/**
 * 市场分析模块
 *
 * 分析市场数据并生成信号
 */

import { fetchCandles, fetchMultiTimeframeData } from '../api/binance.ts';
import { calculateRSI, calculateMACD } from '../indicators/technical.ts';
import { saveAnalysisResult } from '../utils/storage.ts';
import { logInfo, logSuccess, logWarning } from '../utils/helpers.ts';

/**
 * 运行指定币种的分析
 *
 * @param symbol 交易对名称
 * @param interval K 线时间间隔
 */
export async function runAnalysis(
  symbol: string,
  interval = '1h'
): Promise<void> {
  logInfo(`分析 ${symbol} 的市场数据，时间周期: ${interval}`);

  // 获取多个时间周期的 K 线数据
  const candlesData = await fetchMultiTimeframeData(symbol, true);

  // 分析结果
  const results: Record<string, any> = {};

  // 对每个时间周期进行分析
  for (const [timeframe, candles] of Object.entries(candlesData)) {
    if (candles.length < 30) {
      logWarning(`${symbol} ${timeframe} 数据不足，跳过分析`);
      continue;
    }

    // 计算技术指标
    const rsi = calculateRSI(candles);
    const macd = calculateMACD(candles);

    // 检查超卖信号
    const isOversold = rsi[rsi.length - 1] < 30;

    // 检查 MACD 底背离
    const hasDivergence = checkMACD_Divergence(candles, macd);

    // 保存分析结果
    results[timeframe] = {
      lastClose: candles[candles.length - 1].close,
      rsi: rsi[rsi.length - 1],
      macd: macd.MACD[macd.MACD.length - 1],
      signal: macd.signal[macd.signal.length - 1],
      histogram: macd.histogram[macd.histogram.length - 1],
      isOversold,
      hasDivergence,
    };

    logInfo(
      `${symbol} ${timeframe} 分析: RSI=${rsi[rsi.length - 1].toFixed(
        2
      )}, 超卖: ${isOversold}, 底背离: ${hasDivergence}`
    );
  }

  // 保存总体分析结果
  await saveAnalysisResult(symbol, results);

  // 检查是否有信号
  const hasSignal = Object.values(results).some(
    (r) => r.isOversold && r.hasDivergence
  );

  if (hasSignal) {
    logSuccess(`${symbol} 检测到强烈反转信号！`);
  } else {
    logInfo(`${symbol} 未检测到明显信号`);
  }
}

/**
 * 检查 MACD 底背离
 *
 * @param candles K 线数据
 * @param macd MACD 数据
 * @returns 是否有底背离
 */
function checkMACD_Divergence(candles: any[], macd: any): boolean {
  if (candles.length < 30 || macd.histogram.length < 30) {
    return false;
  }

  // 获取最近的数据
  const recent = candles.slice(-30);
  const recentHistogram = macd.histogram.slice(-30);

  // 寻找近期低点
  let priceMinIndex = 0;
  let histogramMinIndex = 0;

  for (let i = 1; i < recent.length; i++) {
    if (recent[i].low < recent[priceMinIndex].low) {
      priceMinIndex = i;
    }

    if (recentHistogram[i] < recentHistogram[histogramMinIndex]) {
      histogramMinIndex = i;
    }
  }

  // 如果价格创新低但 MACD 柱状图没有创新低，则存在底背离
  return (
    priceMinIndex > histogramMinIndex &&
    recent[priceMinIndex].low < recent[histogramMinIndex].low &&
    recentHistogram[priceMinIndex] > recentHistogram[histogramMinIndex]
  );
}
