/**
 * 技术指标计算器
 *
 * 提供各种技术指标的计算功能
 */

import { Candle, IndicatorValues } from '../models/types.ts';

/**
 * 计算相对强弱指数 (RSI)
 *
 * @param candles K 线数据
 * @param period 计算周期，默认 14
 * @returns RSI 值
 */
export function calculateRSI(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) {
    return 50; // 默认返回中性值
  }

  let gains = 0;
  let losses = 0;

  // 计算初始平均涨跌幅
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change >= 0) {
      gains += change;
    } else {
      losses -= change; // 取绝对值
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // 计算剩余数据的 RSI
  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;

    if (change >= 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - change) / period;
    }
  }

  // 避免除零错误
  if (avgLoss === 0) {
    return 100;
  }

  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  return rsi;
}

/**
 * 计算移动平均线
 *
 * @param candles K 线数据
 * @param period 计算周期
 * @returns 移动平均线值
 */
export function calculateMA(candles: Candle[], period: number): number {
  if (candles.length < period) {
    return candles[candles.length - 1].close; // 数据不足时返回最新收盘价
  }

  const slice = candles.slice(candles.length - period);
  const sum = slice.reduce((acc, candle) => acc + candle.close, 0);

  return sum / period;
}

/**
 * 计算指数移动平均线 (EMA)
 *
 * @param candles K 线数据
 * @param period 计算周期
 * @returns EMA 值
 */
export function calculateEMA(candles: Candle[], period: number): number {
  if (candles.length < period) {
    return candles[candles.length - 1].close;
  }

  // 计算 SMA 作为初始 EMA
  const sma = calculateMA(candles.slice(0, period), period);
  const multiplier = 2 / (period + 1);

  let ema = sma;

  // 计算 EMA
  for (let i = period; i < candles.length; i++) {
    ema = (candles[i].close - ema) * multiplier + ema;
  }

  return ema;
}

/**
 * 计算 MACD
 *
 * @param candles K 线数据
 * @param fastPeriod 快线周期，默认 12
 * @param slowPeriod 慢线周期，默认 26
 * @param signalPeriod 信号线周期，默认 9
 * @returns MACD 指标值
 */
export function calculateMACD(
  candles: Candle[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
) {
  // 计算快线和慢线 EMA
  const fastEMA = calculateEMA(candles, fastPeriod);
  const slowEMA = calculateEMA(candles, slowPeriod);

  // 计算 MACD 线 (快线 - 慢线)
  const macdLine = fastEMA - slowEMA;

  // 为信号线计算 EMA
  // 注意：这只是一个简化实现，完整实现需要对历史 MACD 值计算 EMA
  // 这里简化为直接使用 MACD 值的 1/3 代表信号线
  const signalLine = macdLine * (1 - 2 / (signalPeriod + 1));

  // 计算柱状图值
  const histogram = macdLine - signalLine;

  return {
    macd: macdLine,
    signal: signalLine,
    histogram,
  };
}

/**
 * 计算布林带
 *
 * @param candles K 线数据
 * @param period 周期，默认 20
 * @param stdDev 标准差倍数，默认 2
 * @returns 布林带值
 */
export function calculateBollingerBands(
  candles: Candle[],
  period = 20,
  stdDev = 2
) {
  if (candles.length < period) {
    const price = candles[candles.length - 1].close;
    return {
      upper: price * 1.1,
      middle: price,
      lower: price * 0.9,
    };
  }

  // 计算中轨 (SMA)
  const middle = calculateMA(candles, period);

  // 计算标准差
  const slice = candles.slice(candles.length - period);
  const variance =
    slice.reduce((acc, candle) => {
      const diff = candle.close - middle;
      return acc + diff * diff;
    }, 0) / period;

  const standardDeviation = Math.sqrt(variance);

  // 计算上下轨
  const upper = middle + stdDev * standardDeviation;
  const lower = middle - stdDev * standardDeviation;

  return {
    upper,
    middle,
    lower,
  };
}

/**
 * 计算所有技术指标
 *
 * @param candles K 线数据
 * @returns 所有技术指标的值
 */
export function calculateAllIndicators(candles: Candle[]): IndicatorValues {
  const rsi = calculateRSI(candles);
  const macd = calculateMACD(candles);
  const bollingerBands = calculateBollingerBands(candles);

  const movingAverages = {
    ma7: calculateMA(candles, 7),
    ma25: calculateMA(candles, 25),
    ma99: calculateMA(candles, Math.min(99, candles.length - 1)),
  };

  return {
    rsi,
    macd,
    bollingerBands,
    movingAverages,
  };
}
