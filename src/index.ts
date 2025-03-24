/**
 * 币安合约反转信号监控系统
 *
 * 主程序入口文件
 */

import { fetchGainersList } from './api/binance.ts';
import { analyzeSymbols } from './indicators/analyzer.ts';
import { notify } from './notifications/notifier.ts';
import { parseArgs } from '@std/cli/parse-args';
import { runBacktest } from './backtest/index.ts';
import {
  initDataDirectories,
  loadHistoryAnalysis,
  saveAnalysisResult,
} from './utils/storage.ts';
import {
  formatNumber,
  logInfo,
  logSuccess,
  logWarning,
  logError,
} from './utils/helpers.ts';

// 跟踪的币种集合，记录每个币种的历史数据
const trackedSymbols = new Map<
  string,
  {
    symbol: string;
    lastPrice: number;
    highestPrice: number;
    lastUpdateTime: number;
    signals: string[];
    downtrend: boolean;
    downtrendConfirmed: boolean;
    downtrendNotified: boolean;
  }
>();

/**
 * 启动监控服务
 *
 * 主要功能流程：
 * 1. 定期获取币安涨幅榜数据
 * 2. 分析各个币种的技术指标
 * 3. 持续跟踪币种价格，记录高点
 * 4. 检测上涨乏力和确认下跌的币种
 * 5. 发送警报通知
 */
export async function startMonitoring(
  limit = 50,
  interval = '1h'
): Promise<void> {
  logInfo('开始监控币安合约市场涨幅榜...');

  try {
    // 加载历史分析结果
    const historicalData = await loadHistoryAnalysis();

    // 恢复历史跟踪状态
    if (historicalData && historicalData.length > 0) {
      for (const item of historicalData) {
        if (item.symbol && item.lastPrice) {
          trackedSymbols.set(item.symbol, {
            symbol: item.symbol,
            lastPrice: item.lastPrice,
            highestPrice: item.highestPrice || item.lastPrice,
            lastUpdateTime: item.timestamp || Date.now(),
            signals: item.signals || [],
            downtrend: item.downtrend || false,
            downtrendConfirmed: item.downtrendConfirmed || false,
            downtrendNotified: item.downtrendNotified || false,
          });
        }
      }
      logInfo(`从历史数据恢复了 ${trackedSymbols.size} 个跟踪币种`);
    }

    // 获取币安涨幅榜数据
    const gainersList = await fetchGainersList(limit);
    logInfo(`获取到 ${gainersList.length} 个涨幅榜币种`);

    // 更新跟踪列表，添加新的币种
    for (const gainer of gainersList) {
      if (!trackedSymbols.has(gainer.symbol)) {
        // 新币种加入跟踪列表
        trackedSymbols.set(gainer.symbol, {
          symbol: gainer.symbol,
          lastPrice: gainer.lastPrice,
          highestPrice: gainer.lastPrice, // 初始高点为当前价格
          lastUpdateTime: Date.now(),
          signals: [],
          downtrend: false,
          downtrendConfirmed: false,
          downtrendNotified: false,
        });
        logInfo(
          `添加新币种到跟踪列表: ${gainer.symbol}, 当前价格: ${gainer.lastPrice}`
        );
      } else {
        // 更新已跟踪币种的价格
        const trackedSymbol = trackedSymbols.get(gainer.symbol)!;

        // 更新高点
        if (gainer.lastPrice > trackedSymbol.highestPrice) {
          trackedSymbol.highestPrice = gainer.lastPrice;
          trackedSymbol.downtrend = false; // 创新高，重置下跌标记
          trackedSymbol.downtrendConfirmed = false;
          trackedSymbol.downtrendNotified = false;
          logInfo(`${gainer.symbol} 创新高: ${gainer.lastPrice}`);
        }

        // 更新最新价格和时间
        trackedSymbol.lastPrice = gainer.lastPrice;
        trackedSymbol.lastUpdateTime = Date.now();
      }
    }

    // 分析所有跟踪的币种
    const symbolsToAnalyze = Array.from(trackedSymbols.values()).map(
      (item) => ({
        symbol: item.symbol,
        lastPrice: item.lastPrice,
      })
    );

    const results = await analyzeSymbols(symbolsToAnalyze, interval);

    // 处理分析结果
    const weakBullishSymbols = []; // 上涨乏力的币种
    const confirmedDowntrendSymbols = []; // 确认下跌的币种

    for (const result of results) {
      const trackedSymbol = trackedSymbols.get(result.symbol);
      if (!trackedSymbol) continue;

      // 更新信号
      trackedSymbol.signals = result.signals;

      // 计算与高点的跌幅百分比
      const dropPercentage =
        ((trackedSymbol.highestPrice - trackedSymbol.lastPrice) /
          trackedSymbol.highestPrice) *
        100;

      // 检查是否上涨乏力（根据技术指标和价格没有创新高）
      if (
        result.probability > 70 &&
        trackedSymbol.lastPrice < trackedSymbol.highestPrice &&
        !trackedSymbol.downtrend
      ) {
        trackedSymbol.downtrend = true;
        weakBullishSymbols.push({
          symbol: result.symbol,
          probability: result.probability,
          lastPrice: trackedSymbol.lastPrice,
          highestPrice: trackedSymbol.highestPrice,
          dropPercentage,
          signals: result.signals,
        });
      }

      // 检查是否确认下跌（从高点下跌超过5%）
      if (dropPercentage > 5 && !trackedSymbol.downtrendConfirmed) {
        trackedSymbol.downtrendConfirmed = true;
        if (!trackedSymbol.downtrendNotified) {
          trackedSymbol.downtrendNotified = true;
          confirmedDowntrendSymbols.push({
            symbol: result.symbol,
            probability: result.probability,
            lastPrice: trackedSymbol.lastPrice,
            highestPrice: trackedSymbol.highestPrice,
            dropPercentage,
            signals: result.signals,
          });
        }
      }
    }

    // 输出上涨乏力的币种
    if (weakBullishSymbols.length > 0) {
      logSuccess(`检测到 ${weakBullishSymbols.length} 个上涨乏力的币种：`);

      // 按照反转信号概率排序
      weakBullishSymbols.sort((a, b) => b.probability - a.probability);

      for (const symbol of weakBullishSymbols) {
        logInfo(
          `- ${symbol.symbol}: 反转概率 ${symbol.probability.toFixed(
            2
          )}%, 当前价格: ${
            symbol.lastPrice
          }, 距离高点: ${symbol.dropPercentage.toFixed(2)}%`
        );

        // 发送通知
        await notify({
          symbol: symbol.symbol,
          probability: symbol.probability,
          signals: symbol.signals as any[],
          price: symbol.lastPrice,
          message: `上涨乏力信号: 距离高点 ${
            symbol.highestPrice
          } 下跌 ${symbol.dropPercentage.toFixed(2)}%`,
          highestPrice: symbol.highestPrice,
          dropPercent: symbol.dropPercentage,
        });
      }
    } else {
      logInfo('没有检测到上涨乏力的币种');
    }

    // 输出确认下跌的币种
    if (confirmedDowntrendSymbols.length > 0) {
      logSuccess(
        `检测到 ${confirmedDowntrendSymbols.length} 个确认下跌的币种：`
      );

      // 按照下跌幅度排序
      confirmedDowntrendSymbols.sort(
        (a, b) => b.dropPercentage - a.dropPercentage
      );

      for (const symbol of confirmedDowntrendSymbols) {
        logInfo(
          `- ${symbol.symbol}: 确认下跌! 当前价格: ${
            symbol.lastPrice
          }, 从高点 ${symbol.highestPrice} 下跌 ${symbol.dropPercentage.toFixed(
            2
          )}%`
        );

        // 发送下跌确认通知
        await notify({
          symbol: symbol.symbol,
          probability: 100, // 确认下跌为100%概率
          signals: [`从高点下跌超过5%`],
          price: symbol.lastPrice,
          message: `⚠️ 确认下跌! 从高点 ${
            symbol.highestPrice
          } 下跌 ${symbol.dropPercentage.toFixed(2)}%`,
          highestPrice: symbol.highestPrice,
          dropPercent: symbol.dropPercentage,
        });
      }
    }

    // 保存当前跟踪状态
    const trackingData = Array.from(trackedSymbols.values()).map((item) => ({
      symbol: item.symbol,
      lastPrice: item.lastPrice,
      highestPrice: item.highestPrice,
      timestamp: item.lastUpdateTime,
      signals: item.signals,
      downtrend: item.downtrend,
      downtrendConfirmed: item.downtrendConfirmed,
      downtrendNotified: item.downtrendNotified,
    }));

    await saveAnalysisResult(trackingData);

    // 清理长期不活跃的币种（超过7天未更新）
    const now = Date.now();
    const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
    let cleanedCount = 0;

    for (const [symbol, data] of trackedSymbols.entries()) {
      if (now - data.lastUpdateTime > oneWeekInMs) {
        trackedSymbols.delete(symbol);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logInfo(`清理了 ${cleanedCount} 个长期不活跃的币种`);
    }

    // 设置定时任务继续监控
    logInfo('系统将在 1 小时后再次检查');
    setTimeout(() => startMonitoring(limit, interval), 60 * 60 * 1000); // 默认1小时检查一次
  } catch (error) {
    logError('监控过程中出现错误:' + error);
    // 5分钟后重试
    logInfo('系统将在 5 分钟后重试');
    setTimeout(() => startMonitoring(limit, interval), 5 * 60 * 1000);
  }
}

// 解析命令行参数
const args = parseArgs(Deno.args, {
  string: ['mode', 'limit', 'interval', 'start-date', 'end-date'],
  default: {
    mode: 'monitor',
    limit: '20',
    interval: '1h',
  },
});

// 使用示例说明
function printUsage() {
  console.log(`
币安合约熊市信号监控工具

用法:
  deno run -A src/index.ts [options]
  deno run -A src/index.ts --mode=backtest --start-date=2023-01-01 [options]

选项:
  --mode              运行模式: monitor(监控) 或 backtest(回测), 默认: monitor
  --limit             分析时获取的币种数量, 默认: 20
  --interval          K 线间隔, 默认: 1h
  --start-date        回测模式下的起始日期, 格式: YYYY-MM-DD
  --end-date          回测模式下的结束日期, 格式: YYYY-MM-DD, 可选
  `);
}

// 主函数
async function main() {
  // 初始化数据目录
  await initDataDirectories();

  const mode = args.mode as string;
  const limit = parseInt(args.limit as string);
  const interval = args.interval as string;

  logInfo(`运行模式: ${mode}`);

  if (mode === 'monitor') {
    logInfo(`开始监控涨幅榜前 ${limit} 名币种, 时间间隔: ${interval}`);
    await startMonitoring(limit, interval);
  } else if (mode === 'backtest') {
    // 回测模式下需要指定起始日期
    const startDate = args['start-date'] as string;
    const endDate = args['end-date'] as string;

    if (!startDate) {
      logWarning('回测模式下必须指定 --start-date 参数');
      printUsage();
      Deno.exit(1);
    }

    logInfo(
      `开始回测，日期范围: ${startDate}${
        endDate ? ` 至 ${endDate}` : ''
      }, 时间间隔: ${interval}`
    );
    await runBacktest(startDate, endDate, interval);
  } else {
    logWarning(`未知模式: ${mode}`);
    printUsage();
    Deno.exit(1);
  }
}

// 运行主函数
main().catch((error) => {
  console.error('程序执行错误:', error);
  Deno.exit(1);
});
