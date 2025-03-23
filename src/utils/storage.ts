/**
 * 数据存储工具
 *
 * 负责将数据持久化到本地文件系统
 */

import { GainerInfo, AnalysisResult, Candle } from '../models/types.ts';
import { ensureDir, exists } from '@std/fs';
import { format } from '@std/datetime';
import { logInfo, logWarning, logError } from './helpers.ts';

// 数据目录路径
export const DATA_DIR = './data';
const ANALYSIS_DIR = `${DATA_DIR}/analysis`;
const HISTORY_DIR = `${DATA_DIR}/history`;
const CANDLES_DIR = `${DATA_DIR}/candles`;

/**
 * 初始化数据目录结构
 *
 * 确保所有需要的数据目录都已创建
 */
export async function initDataDirectories(): Promise<void> {
  await ensureDir(DATA_DIR);
  await ensureDir(ANALYSIS_DIR);
  await ensureDir(HISTORY_DIR);
  await ensureDir(CANDLES_DIR);
  logInfo('数据目录初始化完成');
}

/**
 * 确保数据目录存在
 */
async function ensureDataDirs(): Promise<void> {
  await ensureDir(ANALYSIS_DIR);
  await ensureDir(HISTORY_DIR);
  await ensureDir(CANDLES_DIR);
}

/**
 * 获取格式化的当前日期作为文件名
 */
function getDateString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * 保存分析结果
 *
 * @param results 分析结果数组
 */
export async function saveAnalysisResults(
  results: AnalysisResult[]
): Promise<void> {
  if (results.length === 0) return;

  await ensureDataDirs();

  const dateStr = getDateString();
  const timestamp = new Date().toISOString();
  const filename = `${ANALYSIS_DIR}/${dateStr}.json`;

  // 检查文件是否存在，决定是追加还是创建
  let existingData: { timestamp: string; results: AnalysisResult[] }[] = [];

  if (await exists(filename)) {
    try {
      const content = await Deno.readTextFile(filename);
      existingData = JSON.parse(content);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logError(`读取分析历史数据文件失败: ${errorMessage}`);
      // 如果读取失败，使用空数组继续
    }
  }

  // 追加新数据
  existingData.push({
    timestamp,
    results,
  });

  // 写入文件
  await Deno.writeTextFile(filename, JSON.stringify(existingData, null, 2));

  logInfo(`分析结果已保存到: ${filename}`);
}

/**
 * 保存涨幅榜数据
 *
 * @param gainersList 涨幅榜数据
 */
export async function saveGainersList(
  gainersList: GainerInfo[]
): Promise<void> {
  if (gainersList.length === 0) return;

  await ensureDataDirs();

  const dateStr = getDateString();
  const timestamp = new Date().toISOString();
  const filename = `${HISTORY_DIR}/${dateStr}.json`;

  // 检查文件是否存在，决定是追加还是创建
  let existingData: { timestamp: string; gainersList: GainerInfo[] }[] = [];

  if (await exists(filename)) {
    try {
      const content = await Deno.readTextFile(filename);
      existingData = JSON.parse(content);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logError(`读取涨幅榜历史数据文件失败: ${errorMessage}`);
    }
  }

  // 追加新数据
  existingData.push({
    timestamp,
    gainersList,
  });

  // 写入文件
  await Deno.writeTextFile(filename, JSON.stringify(existingData, null, 2));

  logInfo(`涨幅榜数据已保存到: ${filename}`);
}

/**
 * 保存 K 线数据
 *
 * @param symbol 交易对
 * @param timeframe 时间周期
 * @param candles K 线数据
 */
export async function saveCandles(
  symbol: string,
  timeframe: string,
  candles: Candle[]
): Promise<void> {
  if (candles.length === 0) return;

  await ensureDataDirs();

  // 为每个交易对创建单独的目录
  const symbolDir = `${CANDLES_DIR}/${symbol}`;
  await ensureDir(symbolDir);

  const dateStr = getDateString();
  const filename = `${symbolDir}/${timeframe}_${dateStr}.json`;

  // 写入文件 (K线数据不追加，直接覆盖)
  await Deno.writeTextFile(
    filename,
    JSON.stringify(
      {
        symbol,
        timeframe,
        timestamp: new Date().toISOString(),
        candles,
      },
      null,
      2
    )
  );
}

/**
 * 读取历史分析结果
 *
 * @param date 日期，默认为当天
 * @returns 历史分析结果
 */
export async function loadAnalysisResults(
  date: Date = new Date()
): Promise<AnalysisResult[][]> {
  const dateStr = format(date, 'yyyy-MM-dd');
  const filename = `${ANALYSIS_DIR}/${dateStr}.json`;

  if (!(await exists(filename))) {
    return [];
  }

  try {
    const content = await Deno.readTextFile(filename);
    const data = JSON.parse(content);
    return data.map((item: { results: AnalysisResult[] }) => item.results);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError(`读取历史分析结果失败: ${errorMessage}`);
    return [];
  }
}

/**
 * 读取历史涨幅榜数据
 *
 * @param date 日期，默认为当天
 * @returns 历史涨幅榜数据
 */
export async function loadGainersList(
  date: Date = new Date()
): Promise<GainerInfo[][]> {
  const dateStr = format(date, 'yyyy-MM-dd');
  const filename = `${HISTORY_DIR}/${dateStr}.json`;

  if (!(await exists(filename))) {
    return [];
  }

  try {
    const content = await Deno.readTextFile(filename);
    const data = JSON.parse(content);
    return data.map((item: { gainersList: GainerInfo[] }) => item.gainersList);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError(`读取历史涨幅榜数据失败: ${errorMessage}`);
    return [];
  }
}

/**
 * 读取历史 K 线数据
 *
 * @param symbol 交易对
 * @param timeframe 时间周期
 * @param date 日期，默认为当天
 * @returns K 线数据数组
 */
export async function loadCandles(
  symbol: string,
  timeframe: string,
  date: Date = new Date()
): Promise<Candle[]> {
  const dateStr = format(date, 'yyyy-MM-dd');
  const filename = `${CANDLES_DIR}/${symbol}/${timeframe}_${dateStr}.json`;

  if (!(await exists(filename))) {
    return [];
  }

  try {
    const content = await Deno.readTextFile(filename);
    const data = JSON.parse(content);
    return data.candles;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError(`读取历史 K 线数据失败: ${errorMessage}`);
    return [];
  }
}

/**
 * 保存分析结果到文件
 *
 * @param data 分析结果数据
 */
export async function saveAnalysisResult(data: any[]): Promise<void> {
  try {
    await ensureDir(ANALYSIS_DIR);

    const today = new Date();
    const dateStr = format(today, 'yyyy-MM-dd');
    const filename = `${ANALYSIS_DIR}/${dateStr}.json`;

    // 写入文件
    await Deno.writeTextFile(filename, JSON.stringify(data, null, 2));

    logInfo(`分析结果已保存到: ${filename}`);
  } catch (error) {
    logError(`保存分析结果失败: ${error}`);
  }
}

/**
 * 保存回测结果到本地文件
 *
 * @param name 回测标识名称
 * @param data 回测结果数据
 * @param strategy 策略名称
 */
export async function saveBacktestResult(
  name: string,
  data: any,
  strategy: string
): Promise<void> {
  try {
    const backTestDir = `${DATA_DIR}/backtest/${strategy}`;
    await ensureDir(backTestDir);

    const filePath = `${backTestDir}/${name}.json`;
    await Deno.writeTextFile(filePath, JSON.stringify(data, null, 2));
    logInfo(`回测结果已保存至 ${filePath}`);
  } catch (error) {
    logError(`保存回测结果失败: ${error}`);
  }
}

/**
 * 从文件加载回测结果
 *
 * @param name 回测标识名称
 * @param strategy 策略名称
 * @returns 回测结果数据
 */
export async function loadBacktestResult(
  name: string,
  strategy: string
): Promise<any> {
  try {
    const filePath = `${DATA_DIR}/backtest/${strategy}/${name}.json`;

    // 检查文件是否存在
    if (!(await exists(filePath))) {
      logWarning(`回测结果文件不存在: ${filePath}`);
      return null;
    }

    // 读取文件内容
    const content = await Deno.readTextFile(filePath);
    const data = JSON.parse(content);
    logInfo(`已加载回测结果: ${filePath}`);

    return data;
  } catch (error) {
    logError(`加载回测结果失败: ${error}`);
    return null;
  }
}

/**
 * 加载历史分析结果
 *
 * @returns 历史分析数据，如果不存在则返回空数组
 */
export async function loadHistoryAnalysis(): Promise<any[]> {
  try {
    const today = new Date();
    const dateStr = format(today, 'yyyy-MM-dd');
    const filename = `${ANALYSIS_DIR}/${dateStr}.json`;

    // 检查文件是否存在
    if (!(await exists(filename))) {
      // 尝试加载前一天的数据
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = format(yesterday, 'yyyy-MM-dd');
      const yesterdayFilename = `${ANALYSIS_DIR}/${yesterdayStr}.json`;

      if (!(await exists(yesterdayFilename))) {
        return [];
      }

      const content = await Deno.readTextFile(yesterdayFilename);
      return JSON.parse(content);
    }

    const content = await Deno.readTextFile(filename);
    return JSON.parse(content);
  } catch (error) {
    logError(`加载历史分析结果失败: ${error}`);
    return [];
  }
}
