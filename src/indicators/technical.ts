/**
 * 技术指标计算模块
 *
 * 实现各种技术分析指标的计算
 */

import { Candle } from '../models/types.ts';

/**
 * 计算相对强弱指标 (RSI)
 *
 * @param candles K 线数据
 * @param period 计算周期，默认为 14
 * @returns RSI 值数组
 */
export function calculateRSI(candles: Candle[], period = 14): number[] {
  if (candles.length < period + 1) {
    return [];
  }

  const closes = candles.map((candle) => candle.close);
  const rsi: number[] = [];
  let gains = 0;
  let losses = 0;

  // 首先计算第一个 RSI 值
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }

  // 避免除零错误
  if (losses === 0) {
    rsi.push(100);
  } else {
    const rs = gains / losses;
    rsi.push(100 - 100 / (1 + rs));
  }

  // 计算剩余的 RSI 值
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];

    // 更新 gains 和 losses
    if (diff >= 0) {
      gains = (gains * (period - 1) + diff) / period;
      losses = (losses * (period - 1)) / period;
    } else {
      gains = (gains * (period - 1)) / period;
      losses = (losses * (period - 1) - diff) / period;
    }

    // 避免除零错误
    if (losses === 0) {
      rsi.push(100);
    } else {
      const rs = gains / losses;
      rsi.push(100 - 100 / (1 + rs));
    }
  }

  // 填充前面的空值，确保返回数组长度与输入数组长度一致
  return Array(period).fill(null).concat(rsi);
}

/**
 * 计算移动平均
 *
 * @param data 数据数组
 * @param period 计算周期
 * @returns 移动平均值数组
 */
export function calculateMA(data: number[], period: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }

    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j];
    }

    result.push(sum / period);
  }

  return result;
}

/**
 * 计算指数移动平均
 *
 * @param data 数据数组
 * @param period 计算周期
 * @returns EMA 值数组
 */
export function calculateEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];

  // 计算第一个 EMA 值作为简单平均
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }

  ema.push(sum / period);

  // 计算其余 EMA 值
  for (let i = period; i < data.length; i++) {
    ema.push(data[i] * k + ema[ema.length - 1] * (1 - k));
  }

  // 填充前面的空值，确保返回数组长度与输入数组长度一致
  return Array(period - 1)
    .fill(NaN)
    .concat(ema);
}

/**
 * 计算 MACD (移动平均收敛发散)
 *
 * @param candles K 线数据
 * @param fastPeriod 快线周期，默认为 12
 * @param slowPeriod 慢线周期，默认为 26
 * @param signalPeriod 信号线周期，默认为 9
 * @returns MACD 结果对象
 */
export function calculateMACD(
  candles: Candle[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): { MACD: number[]; signal: number[]; histogram: number[] } {
  // 提取收盘价
  const closes = candles.map((candle) => candle.close);

  // 计算快线和慢线 EMA
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  // 计算 MACD 线 (DIF)
  const MACD: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (isNaN(fastEMA[i]) || isNaN(slowEMA[i])) {
      MACD.push(NaN);
    } else {
      MACD.push(fastEMA[i] - slowEMA[i]);
    }
  }

  // 计算信号线 (DEA)
  // 注意：只为有效的 MACD 值计算 EMA
  const validMACD = MACD.filter((value) => !isNaN(value));
  const validSignal = calculateEMA(validMACD, signalPeriod);

  // 将 validSignal 映射回原始长度
  const signal: number[] = Array(MACD.length).fill(NaN);
  let validIndex = 0;

  for (let i = 0; i < MACD.length; i++) {
    if (!isNaN(MACD[i])) {
      if (validIndex < validSignal.length) {
        signal[i] = validSignal[validIndex];
        validIndex++;
      }
    }
  }

  // 计算柱状图 (MACD Histogram)
  const histogram = MACD.map((value, i) => {
    if (isNaN(value) || isNaN(signal[i])) {
      return NaN;
    }
    return value - signal[i];
  });

  return { MACD, signal, histogram };
}

/**
 * 计算布林带指标
 *
 * @param candles K 线数据
 * @param period 计算周期，默认为 20
 * @param multiplier 标准差乘数，默认为 2
 * @returns 布林带数据对象
 */
export function calculateBollingerBands(
  candles: Candle[],
  period = 20,
  multiplier = 2
): { upper: number[]; middle: number[]; lower: number[] } {
  const closes = candles.map((candle) => candle.close);
  const middle = calculateMA(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
      continue;
    }

    // 计算标准差
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += Math.pow(closes[i - j] - middle[i], 2);
    }

    const stdDev = Math.sqrt(sum / period);

    upper.push(middle[i] + multiplier * stdDev);
    lower.push(middle[i] - multiplier * stdDev);
  }

  return { upper, middle, lower };
}

/**
 * 计算多个移动平均线
 *
 * @param candles K 线数据
 * @returns 20、50、200 日移动平均线数组
 */
export function calculateMovingAverages(candles: Candle[]): {
  ma20: number[];
  ma50: number[];
  ma200: number[];
} {
  const ma20 = [];
  const ma50 = [];
  const ma200 = [];

  const prices = candles.map((c) => c.close);

  // 计算 20 日移动平均线
  for (let i = 0; i < prices.length; i++) {
    if (i < 19) {
      ma20.push(NaN);
    } else {
      const sum = prices.slice(i - 19, i + 1).reduce((a, b) => a + b, 0);
      ma20.push(sum / 20);
    }
  }

  // 计算 50 日移动平均线
  for (let i = 0; i < prices.length; i++) {
    if (i < 49) {
      ma50.push(NaN);
    } else {
      const sum = prices.slice(i - 49, i + 1).reduce((a, b) => a + b, 0);
      ma50.push(sum / 50);
    }
  }

  // 计算 200 日移动平均线
  for (let i = 0; i < prices.length; i++) {
    if (i < 199) {
      ma200.push(NaN);
    } else {
      const sum = prices.slice(i - 199, i + 1).reduce((a, b) => a + b, 0);
      ma200.push(sum / 200);
    }
  }

  return { ma20, ma50, ma200 };
}
