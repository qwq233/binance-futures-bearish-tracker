/**
 * 回测模块
 *
 * 模拟系统在历史某个时间点的完整工作流程
 */

import { fetchCandles, fetchHistoricalGainers } from '../api/binance.ts';
import { analyzeSymbols } from '../indicators/analyzer.ts';
import { saveBacktestResult, loadBacktestResult } from '../utils/storage.ts';
import { logInfo, logSuccess, logWarning, logError } from '../utils/helpers.ts';
import { GainerInfo, AnalysisResult, TrackedSymbol } from '../models/types.ts';
import { format } from '@std/datetime';

// 从 binance.ts 导入 API 基础 URL
const BINANCE_API_BASE = 'https://fapi.binance.com';

// 跟踪的币种列表（回测期间的状态保持）
const trackedSymbols = new Map<string, TrackedSymbol>();

/**
 * 运行回测
 *
 * 模拟系统在历史某个时间点的运行
 *
 * @param startDate 回测起始日期 (YYYY-MM-DD)
 * @param endDate 回测结束日期 (YYYY-MM-DD)，可选，默认为起始日期后的 7 天
 * @param interval K 线时间间隔
 */
export async function runBacktest(
  startDate?: string,
  endDate?: string,
  interval = '1h'
): Promise<void> {
  // 如果未指定起始日期，默认使用 30 天前的日期
  if (!startDate) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    startDate = format(thirtyDaysAgo, 'yyyy-MM-dd');
  }

  // 如果未指定结束日期，默认为起始日期后的 7 天
  if (!endDate) {
    const endDateObj = new Date(startDate);
    endDateObj.setDate(endDateObj.getDate() + 7);
    endDate = format(endDateObj, 'yyyy-MM-dd');
  }

  logInfo(
    `开始回测，日期范围: ${startDate} 至 ${endDate}, 时间间隔: ${interval}`
  );

  try {
    // 清空跟踪的币种列表
    trackedSymbols.clear();

    // 按日期范围迭代每一天
    const currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);

    while (currentDate <= endDateObj) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');

      // 获取当天的涨幅榜数据
      const gainers = await fetchHistoricalGainers(dateStr, 20);

      if (!gainers || gainers.length === 0) {
        logWarning(`未找到 ${dateStr} 的历史涨幅榜数据，使用模拟数据`);
        // 使用模拟数据进行回测
        const mockGainers = await generateMockGainers();
        await processDay(dateStr, mockGainers, interval);
      } else {
        // 使用实际历史数据进行回测
        logInfo(`获取到 ${dateStr} 的 ${gainers.length} 个涨幅榜币种`);
        await processDay(dateStr, gainers, interval);
      }

      // 更新当前日期到下一天
      currentDate.setDate(currentDate.getDate() + 1);

      // 每天的处理完成后，等待一会，避免API请求过于频繁
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    logSuccess(`回测完成，时间范围: ${startDate} 至 ${endDate}`);
  } catch (error) {
    logError(`回测过程中出错: ${error}`);
  }
}

/**
 * 处理单天的回测数据
 *
 * @param date 回测日期
 * @param gainers 涨幅榜币种
 * @param interval K线间隔
 */
async function processDay(
  date: string,
  gainers: GainerInfo[],
  interval: string
): Promise<void> {
  logInfo(`处理 ${date} 的数据...`);

  // 分析当天的涨幅榜币种
  const analysisResults = await analyzeSymbols(gainers, interval);

  // 更新或添加跟踪的币种
  for (const gainer of gainers) {
    const symbol = gainer.symbol;
    const currentPrice = gainer.lastPrice;

    if (trackedSymbols.has(symbol)) {
      // 更新已跟踪的币种
      const tracked = trackedSymbols.get(symbol)!;

      // 更新高点价格
      if (currentPrice > tracked.highestPrice) {
        tracked.highestPrice = currentPrice;
        // 重置下跌标志，因为创建了新高
        tracked.downtrend = false;
        tracked.downtrendConfirmed = false;
        tracked.downtrendNotified = false;
      }

      // 检查是否开始下跌
      if (currentPrice < tracked.lastPrice && !tracked.downtrend) {
        tracked.downtrend = true;

        // 在分析结果中查找此币种
        const result = analysisResults.find((r) => r.symbol === symbol);
        if (result) {
          tracked.signals = result.signals || [];
        }

        logInfo(
          `${symbol}: 从 ${tracked.lastPrice} 下跌到 ${currentPrice}，可能开始下跌趋势`
        );
      }

      // 检查是否确认下跌（从高点下跌超过5%）
      const dropPercent =
        ((tracked.highestPrice - currentPrice) / tracked.highestPrice) * 100;
      if (
        tracked.downtrend &&
        dropPercent >= 5 &&
        !tracked.downtrendConfirmed
      ) {
        tracked.downtrendConfirmed = true;
        logInfo(
          `${symbol}: 从高点 ${tracked.highestPrice} 下跌 ${dropPercent.toFixed(
            2
          )}%，确认下跌趋势`
        );
      }

      // 更新最新价格和时间
      tracked.lastPrice = currentPrice;
      tracked.lastUpdateTime = new Date(date).getTime();
    } else {
      // 添加新跟踪的币种
      trackedSymbols.set(symbol, {
        symbol,
        lastPrice: currentPrice,
        highestPrice: currentPrice,
        lastUpdateTime: new Date(date).getTime(),
        signals: [],
        downtrend: false,
        downtrendConfirmed: false,
        downtrendNotified: false,
      });
    }
  }

  // 收集需要显示的信号（上涨乏力或确认下跌的币种）
  const uptrendFailureSignals: AnalysisResult[] = [];
  const downtrendConfirmedSignals: AnalysisResult[] = [];

  for (const [symbol, tracked] of trackedSymbols.entries()) {
    // 查找当前分析结果
    const result = analysisResults.find((r) => r.symbol === symbol);

    if (tracked.downtrend && !tracked.downtrendNotified) {
      // 上涨乏力信号
      if (result) {
        uptrendFailureSignals.push({
          ...result,
          highestPrice: tracked.highestPrice,
        });
      } else {
        // 如果没有当前分析结果，使用跟踪数据创建一个
        uptrendFailureSignals.push({
          symbol,
          price: tracked.lastPrice,
          probability: 70, // 默认概率
          signals: tracked.signals,
          highestPrice: tracked.highestPrice,
        });
      }
    }

    if (tracked.downtrendConfirmed && !tracked.downtrendNotified) {
      // 确认下跌信号
      const dropPercent =
        ((tracked.highestPrice - tracked.lastPrice) / tracked.highestPrice) *
        100;

      if (result) {
        downtrendConfirmedSignals.push({
          ...result,
          highestPrice: tracked.highestPrice,
          dropPercent,
        });
      } else {
        downtrendConfirmedSignals.push({
          symbol,
          price: tracked.lastPrice,
          probability: 90, // 确认下跌默认概率更高
          signals: tracked.signals,
          highestPrice: tracked.highestPrice,
          dropPercent,
        });
      }

      // 标记为已通知
      tracked.downtrendNotified = true;
    }
  }

  // 按概率排序
  uptrendFailureSignals.sort((a, b) => b.probability - a.probability);
  downtrendConfirmedSignals.sort((a, b) => b.probability - a.probability);

  // 保存分析结果
  await saveBacktestResult(
    `${date}_analysis`,
    {
      date,
      interval,
      allSymbols: Array.from(trackedSymbols.values()),
      uptrendFailureSignals,
      downtrendConfirmedSignals,
      totalTracked: trackedSymbols.size,
      totalUptrendFailure: uptrendFailureSignals.length,
      totalDowntrendConfirmed: downtrendConfirmedSignals.length,
    },
    'daily_analysis'
  );

  // 输出分析结果
  logInfo(`${date} 分析完成，当前跟踪 ${trackedSymbols.size} 个币种`);

  if (uptrendFailureSignals.length > 0) {
    logInfo(`检测到 ${uptrendFailureSignals.length} 个上涨乏力信号:`);
    for (const signal of uptrendFailureSignals) {
      logInfo(
        `- ${signal.symbol}: 反转概率 ${signal.probability.toFixed(
          2
        )}%, 当前价格: ${signal.price}, 历史高点: ${signal.highestPrice}`
      );
    }
  }

  if (downtrendConfirmedSignals.length > 0) {
    logInfo(`确认 ${downtrendConfirmedSignals.length} 个下跌趋势:`);
    for (const signal of downtrendConfirmedSignals) {
      logInfo(
        `- ${signal.symbol}: 从高点下跌 ${signal.dropPercent?.toFixed(
          2
        )}%, 当前价格: ${signal.price}, 历史高点: ${signal.highestPrice}`
      );
    }
  }
}

/**
 * 验证回测结果
 *
 * 检查预测的信号在实际后续价格中的表现
 *
 * @param date 验证日期 (YYYY-MM-DD)
 * @param interval K 线时间间隔
 */
async function verifyBacktestResults(
  date: string,
  interval: string
): Promise<void> {
  logInfo(`验证 ${date} 的回测信号表现...`);

  try {
    // 获取前一天的回测结果（预测信号）
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = format(prevDate, 'yyyy-MM-dd');

    // 尝试读取前一天的回测结果
    const prevResults = await loadBacktestResult(
      `${prevDateStr}_all`,
      'market_scan'
    );

    if (
      !prevResults ||
      !prevResults.signals ||
      prevResults.signals.length === 0
    ) {
      logInfo(`未找到 ${prevDateStr} 的回测信号，跳过验证`);
      return;
    }

    logInfo(
      `找到 ${prevResults.signals.length} 个 ${prevDateStr} 的预测信号，验证准确性...`
    );

    // 对每个预测信号进行验证
    const verificationResults = {
      totalSignals: prevResults.signals.length,
      correctPredictions: 0,
      incorrectPredictions: 0,
      accuracyRate: 0,
      details: [] as Array<{
        symbol: string;
        predictedProbability: number;
        actualChange: number;
        isCorrect: boolean;
      }>,
    };

    // 获取当前日期的每个币种价格
    for (const signal of prevResults.signals) {
      try {
        // 获取预测信号当天和验证日期的价格数据
        const startTime = new Date(prevDateStr).getTime();
        const endTime = new Date(date).getTime() + 24 * 60 * 60 * 1000;

        const response = await fetch(
          `${BINANCE_API_BASE}/fapi/v1/klines?symbol=${signal.symbol}&interval=1d&startTime=${startTime}&endTime=${endTime}&limit=2`
        );

        if (!response.ok) {
          logWarning(`获取 ${signal.symbol} 价格数据失败: ${response.status}`);
          continue;
        }

        const data = await response.json();

        if (data.length < 2) {
          logWarning(`${signal.symbol} 价格数据不足，无法验证`);
          continue;
        }

        // 预测当天的收盘价
        const predictionDayClose = parseFloat(data[0][4]);
        // 验证日期的收盘价
        const verificationDayClose = parseFloat(data[1][4]);

        // 计算实际价格变化百分比
        const actualChange =
          ((verificationDayClose - predictionDayClose) / predictionDayClose) *
          100;

        // 对于反转信号（下跌预测），如果实际价格下跌，则预测正确
        const isCorrect =
          (signal.probability > 50 && actualChange < 0) ||
          (signal.probability <= 50 && actualChange >= 0);

        // 更新统计数据
        if (isCorrect) {
          verificationResults.correctPredictions++;
        } else {
          verificationResults.incorrectPredictions++;
        }

        // 记录详细验证结果
        verificationResults.details.push({
          symbol: signal.symbol,
          predictedProbability: signal.probability,
          actualChange,
          isCorrect,
        });

        // 输出验证结果
        const resultText = isCorrect ? '✅ 预测正确' : '❌ 预测错误';
        const changeText =
          actualChange >= 0
            ? `上涨 ${actualChange.toFixed(2)}%`
            : `下跌 ${Math.abs(actualChange).toFixed(2)}%`;

        logInfo(
          `${signal.symbol}: 预测反转概率 ${signal.probability.toFixed(
            2
          )}%, 实际 ${changeText} - ${resultText}`
        );
      } catch (error) {
        logWarning(`验证 ${signal.symbol} 时出错: ${error}`);
      }
    }

    // 计算准确率
    verificationResults.accuracyRate =
      (verificationResults.correctPredictions /
        verificationResults.totalSignals) *
      100;

    logSuccess(
      `${date} 验证完成 - 准确率: ${verificationResults.accuracyRate.toFixed(
        2
      )}% (${verificationResults.correctPredictions}/${
        verificationResults.totalSignals
      })`
    );

    // 保存验证结果
    await saveBacktestResult(
      `${date}_verification`,
      verificationResults,
      'verification'
    );
  } catch (error) {
    logError(`验证过程中出错: ${error}`);
  }
}

/**
 * 生成模拟涨幅榜数据
 * 用于在没有历史数据的情况下进行回测
 */
async function generateMockGainers(): Promise<GainerInfo[]> {
  const symbols = [
    'BTCUSDT',
    'ETHUSDT',
    'BNBUSDT',
    'ADAUSDT',
    'DOGEUSDT',
    'XRPUSDT',
    'DOTUSDT',
    'UNIUSDT',
    'LINKUSDT',
    'LTCUSDT',
    'SOLUSDT',
    'MATICUSDT',
    'AXSUSDT',
    'ATOMUSDT',
    'AVAXUSDT',
    'FILUSDT',
    'ICPUSDT',
    'VETUSDT',
    'TRXUSDT',
    'ETCUSDT',
  ];

  const mockGainers: GainerInfo[] = [];

  // 尝试为每个符号获取一些实际数据
  for (const symbol of symbols) {
    try {
      const candles = await fetchCandles(symbol, '1d', 5);
      if (candles.length > 0) {
        const lastCandle = candles[candles.length - 1];
        const prevCandle = candles[0];

        const priceChange = lastCandle.close - prevCandle.close;
        const priceChangePercent = (priceChange / prevCandle.close) * 100;

        mockGainers.push({
          symbol,
          lastPrice: lastCandle.close,
          priceChange,
          priceChangePercent,
          volume: lastCandle.volume,
          quoteVolume: lastCandle.volume * lastCandle.close,
        });
      }
    } catch (e) {
      logWarning(`获取 ${symbol} 的数据失败：${e}`);
    }
  }

  // 如果获取不到足够的数据，添加一些完全模拟的数据
  while (mockGainers.length < 10) {
    const randomIndex = Math.floor(Math.random() * symbols.length);
    const symbol = symbols[randomIndex];

    if (!mockGainers.some((g) => g.symbol === symbol)) {
      mockGainers.push({
        symbol,
        lastPrice: 1000 + Math.random() * 1000,
        priceChange: 50 + Math.random() * 100,
        priceChangePercent: 5 + Math.random() * 10,
        volume: 1000000 + Math.random() * 5000000,
        quoteVolume: 10000000 + Math.random() * 50000000,
      });
    }
  }

  // 按涨幅排序
  return mockGainers.sort(
    (a, b) => b.priceChangePercent - a.priceChangePercent
  );
}
