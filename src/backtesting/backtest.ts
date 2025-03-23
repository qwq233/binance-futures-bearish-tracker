/**
 * 回测系统
 *
 * 用于验证反转信号的准确性
 */

import { fetchCandles, fetchGainersList } from '../api/binance.ts';
import { analyzeSymbols } from '../indicators/analyzer.ts';
import { GainerInfo, AnalysisResult } from '../models/types.ts';

/**
 * 回测结果
 */
interface BacktestResult {
  symbol: string;
  signalDate: Date;
  signalPrice: number;
  probability: number;
  // 后续价格变动百分比
  priceChange1d: number;
  priceChange3d: number;
  priceChange7d: number;
  successful: boolean; // 是否成功预测了下跌
}

/**
 * 回测配置
 */
interface BacktestConfig {
  startDate: Date;
  endDate: Date;
  minProbability: number; // 最小反转概率
  successThreshold: number; // 成功阈值 (价格下跌百分比)
}

// 默认回测配置
const defaultConfig: BacktestConfig = {
  startDate: new Date('2025-01-01'),
  endDate: new Date(),
  minProbability: 70,
  successThreshold: -5, // 价格下跌 5% 以上视为成功
};

/**
 * 获取历史上的涨幅榜数据
 *
 * 注意：这里使用模拟数据，实际应该从历史数据库获取
 *
 * @param date 日期
 * @returns 涨幅榜数据
 */
async function getHistoricalGainers(date: Date): Promise<GainerInfo[]> {
  // 在实际应用中，这里应该从历史数据库获取指定日期的涨幅榜
  // 这里简化为获取当前的涨幅榜
  console.log(`获取 ${date.toISOString().split('T')[0]} 的历史涨幅榜数据`);

  try {
    const gainersList = await fetchGainersList(20);
    return gainersList;
  } catch (error) {
    console.error('获取历史涨幅榜失败:', error);
    return [];
  }
}

/**
 * 获取未来价格数据
 *
 * @param symbol 交易对
 * @param date 信号日期
 * @returns 未来价格变动百分比
 */
async function getFuturePriceChanges(
  symbol: string,
  date: Date
): Promise<{
  priceChange1d: number;
  priceChange3d: number;
  priceChange7d: number;
}> {
  try {
    // 获取日线数据
    const candles = await fetchCandles(symbol, '1d', 10);

    // 简化版：假设第一个蜡烛是信号日，后面的几个是未来的日子
    // 注意：实际应用中需要根据日期筛选实际的 K 线
    const signalPrice = candles[0].close;

    // 计算未来价格变动
    const priceChange1d =
      candles.length > 1
        ? ((candles[1].close - signalPrice) / signalPrice) * 100
        : 0;

    const priceChange3d =
      candles.length > 3
        ? ((candles[3].close - signalPrice) / signalPrice) * 100
        : 0;

    const priceChange7d =
      candles.length > 7
        ? ((candles[7].close - signalPrice) / signalPrice) * 100
        : 0;

    return {
      priceChange1d,
      priceChange3d,
      priceChange7d,
    };
  } catch (error) {
    console.error(`获取 ${symbol} 未来价格数据失败:`, error);
    return {
      priceChange1d: 0,
      priceChange3d: 0,
      priceChange7d: 0,
    };
  }
}

/**
 * 评估单个分析结果
 *
 * @param result 分析结果
 * @param date 当前回测日期
 * @param config 回测配置
 * @returns 回测结果
 */
async function evaluateResult(
  result: AnalysisResult,
  date: Date,
  config: BacktestConfig
): Promise<BacktestResult> {
  // 获取未来价格变动
  const priceChanges = await getFuturePriceChanges(result.symbol, date);

  // 确定是否成功预测
  // 取三个时间段中最大的下跌幅度
  const maxDrop = Math.min(
    priceChanges.priceChange1d,
    priceChanges.priceChange3d,
    priceChanges.priceChange7d
  );

  const successful = maxDrop <= config.successThreshold;

  return {
    symbol: result.symbol,
    signalDate: date,
    signalPrice: result.price,
    probability: result.probability,
    ...priceChanges,
    successful,
  };
}

/**
 * 运行单日回测
 *
 * @param date 回测日期
 * @param config 回测配置
 * @returns 回测结果
 */
async function runDailyBacktest(
  date: Date,
  config: BacktestConfig
): Promise<BacktestResult[]> {
  // 获取历史涨幅榜数据
  const gainersList = await getHistoricalGainers(date);

  if (gainersList.length === 0) {
    return [];
  }

  // 分析币种
  const analysisResults = await analyzeSymbols(gainersList);

  // 过滤出概率大于阈值的结果
  const highProbResults = analysisResults.filter(
    (result) => result.probability >= config.minProbability
  );

  if (highProbResults.length === 0) {
    console.log(`${date.toISOString().split('T')[0]} 没有高概率反转信号`);
    return [];
  }

  // 评估每个结果
  const evaluationPromises = highProbResults.map((result) =>
    evaluateResult(result, date, config)
  );

  return await Promise.all(evaluationPromises);
}

/**
 * 运行回测
 *
 * @param config 回测配置
 * @returns 回测结果
 */
export async function runBacktest(
  config: BacktestConfig = defaultConfig
): Promise<void> {
  console.log('开始运行回测...');
  console.log(
    `回测期间: ${config.startDate.toISOString().split('T')[0]} 到 ${
      config.endDate.toISOString().split('T')[0]
    }`
  );
  console.log(`最小反转概率阈值: ${config.minProbability}%`);
  console.log(`成功预测阈值: ${config.successThreshold}%\n`);

  // 简化版：只回测当前日期
  // 实际应用应遍历从开始日期到结束日期的每一天
  const results = await runDailyBacktest(new Date(), config);

  // 输出回测结果
  if (results.length > 0) {
    console.log('\n回测结果:');
    console.log('币种\t概率\t1天后\t3天后\t7天后\t结果');
    console.log('----------------------------------------');

    results.forEach((result) => {
      console.log(
        `${result.symbol}\t${result.probability.toFixed(0)}%\t` +
          `${result.priceChange1d.toFixed(2)}%\t` +
          `${result.priceChange3d.toFixed(2)}%\t` +
          `${result.priceChange7d.toFixed(2)}%\t` +
          `${result.successful ? '成功' : '失败'}`
      );
    });

    // 统计成功率
    const successCount = results.filter((r) => r.successful).length;
    const successRate = (successCount / results.length) * 100;

    console.log('\n统计信息:');
    console.log(`总信号数: ${results.length}`);
    console.log(`成功预测数: ${successCount}`);
    console.log(`成功率: ${successRate.toFixed(2)}%`);
  } else {
    console.log('没有找到任何符合条件的反转信号');
  }

  console.log('\n回测完成');
}

/**
 * 回测入口函数
 */
if (import.meta.main) {
  await runBacktest();
}
