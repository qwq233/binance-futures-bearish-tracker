/**
 * 币安 API 接口
 *
 * 负责与币安交易所 API 交互，获取市场数据
 */

import { GainerInfo, Candle } from '../models/types.ts';
import { saveCandles } from '../utils/storage.ts';
import {
  formatPrice,
  logInfo,
  logWarning,
  logError,
} from '../utils/helpers.ts';

// 币安 API 基础 URL
const BINANCE_API_BASE = 'https://fapi.binance.com';

/**
 * 获取币安合约市场涨幅榜
 *
 * @param limit 返回的币种数量，默认为 20
 * @returns 涨幅榜币种信息
 */
export async function fetchGainersList(limit = 20): Promise<GainerInfo[]> {
  try {
    // 获取所有合约交易对 24 小时 ticker 数据
    const response = await fetch(`${BINANCE_API_BASE}/fapi/v1/ticker/24hr`);

    if (!response.ok) {
      throw new Error(
        `API 请求失败: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    // 转换为 GainerInfo 对象并按涨幅排序
    const gainersList: GainerInfo[] = data
      .map((item: any) => ({
        symbol: item.symbol,
        priceChange: parseFloat(item.priceChange),
        priceChangePercent: parseFloat(item.priceChangePercent),
        lastPrice: parseFloat(item.lastPrice),
        volume: parseFloat(item.volume),
        quoteVolume: parseFloat(item.quoteVolume),
      }))
      .sort(
        (a: GainerInfo, b: GainerInfo) =>
          b.priceChangePercent - a.priceChangePercent
      )
      .slice(0, limit);

    return gainersList;
  } catch (error) {
    console.error('获取涨幅榜失败:', error);
    throw error;
  }
}

/**
 * 获取 K 线数据
 *
 * @param symbol 交易对名称
 * @param interval K 线时间间隔
 * @param limit 返回的 K 线数量
 * @param saveToFile 是否保存到本地文件
 * @returns K 线数据数组
 */
export async function fetchCandles(
  symbol: string,
  interval = '1h',
  limit = 100,
  saveToFile = true
): Promise<Candle[]> {
  try {
    const response = await fetch(
      `${BINANCE_API_BASE}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(
        `API 请求失败: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    // 转换为 Candle 对象
    const candles: Candle[] = data.map((item: any) => ({
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5]),
      closeTime: item[6],
    }));

    // 保存到本地文件
    if (saveToFile && candles.length > 0) {
      await saveCandles(symbol, interval, candles).catch((error) => {
        console.warn(`保存 ${symbol} K 线数据失败:`, error);
        // 即使保存失败，仍然继续返回数据
      });
    }

    return candles;
  } catch (error) {
    console.error(`获取 ${symbol} ${interval} K 线数据失败:`, error);
    throw error;
  }
}

/**
 * 获取多个时间周期的 K 线数据
 *
 * @param symbol 交易对名称
 * @param saveToFile 是否保存到本地文件
 * @returns 不同时间周期的 K 线数据
 */
export async function fetchMultiTimeframeData(
  symbol: string,
  saveToFile = true
) {
  const timeframes = ['15m', '1h', '4h', '1d'];
  const results: Record<string, Candle[]> = {};

  // 并行获取所有时间周期的数据
  const promises = timeframes.map((tf) =>
    fetchCandles(symbol, tf, 100, saveToFile)
  );
  const dataArray = await Promise.all(promises);

  // 组织结果
  timeframes.forEach((tf, index) => {
    results[tf] = dataArray[index];
  });

  return results;
}

/**
 * 获取指定日期的历史涨幅榜数据
 *
 * @param date 日期 (YYYY-MM-DD 格式)
 * @param limit 获取数量
 * @returns 涨幅榜币种列表
 */
export async function fetchHistoricalGainers(
  date: string,
  limit = 20
): Promise<GainerInfo[]> {
  try {
    logInfo(`获取 ${date} 的历史涨幅榜数据...`);

    // 将日期转换为时间戳
    const targetDate = new Date(date);
    const targetTimestamp = targetDate.getTime();

    // 获取前一天的日期
    const prevDate = new Date(targetDate);
    prevDate.setDate(prevDate.getDate() - 1);

    // 获取所有可用的合约交易对
    const response = await fetch(`${BINANCE_API_BASE}/fapi/v1/exchangeInfo`);
    if (!response.ok) {
      throw new Error(`获取交易对信息失败: ${response.status}`);
    }

    const exchangeInfo = await response.json();
    const symbols = exchangeInfo.symbols
      .filter((s: any) => s.status === 'TRADING')
      .map((s: any) => s.symbol);

    logInfo(`找到 ${symbols.length} 个交易对，计算 ${date} 的涨幅...`);

    // 获取每个交易对在目标日期的日 K 线数据
    const gainersData: GainerInfo[] = [];

    // 使用 Promise.all 并行处理多个请求
    const chunkSize = 10; // 每批处理的交易对数量

    for (let i = 0; i < symbols.length; i += chunkSize) {
      const chunk = symbols.slice(i, i + chunkSize);

      const promises = chunk.map(async (symbol: string) => {
        try {
          // 获取目标日期的日线数据
          // 币安 API 需要开始时间和结束时间的时间戳（毫秒）
          const startTime = targetTimestamp;
          const endTime = targetTimestamp + 24 * 60 * 60 * 1000; // 加一天

          const url = `${BINANCE_API_BASE}/fapi/v1/klines?symbol=${symbol}&interval=1d&startTime=${startTime}&endTime=${endTime}&limit=1`;
          const response = await fetch(url);

          if (!response.ok) {
            throw new Error(`API 请求失败: ${response.status}`);
          }

          const data = await response.json();

          if (data.length === 0) {
            return null; // 该日期没有数据
          }

          // 获取前一天的收盘价
          const prevDayUrl = `${BINANCE_API_BASE}/fapi/v1/klines?symbol=${symbol}&interval=1d&endTime=${startTime}&limit=1`;
          const prevDayResponse = await fetch(prevDayUrl);

          if (!prevDayResponse.ok) {
            throw new Error(`API 请求失败: ${prevDayResponse.status}`);
          }

          const prevDayData = await prevDayResponse.json();

          if (prevDayData.length === 0) {
            return null; // 前一天没有数据
          }

          // 当日数据
          const currentDayCandle = data[0];
          // 前一天数据
          const prevDayCandle = prevDayData[0];

          // 计算涨跌幅
          const currentClose = parseFloat(currentDayCandle[4]); // 收盘价
          const prevClose = parseFloat(prevDayCandle[4]); // 前一天收盘价
          const priceChange = currentClose - prevClose;
          const priceChangePercent = (priceChange / prevClose) * 100;

          return {
            symbol,
            lastPrice: currentClose,
            priceChange,
            priceChangePercent,
            volume: parseFloat(currentDayCandle[5]), // 成交量
            quoteVolume: parseFloat(currentDayCandle[7]), // 成交额
          };
        } catch (e) {
          logWarning(`获取 ${symbol} 的历史数据失败: ${e}`);
          return null;
        }
      });

      const results = await Promise.all(promises);
      gainersData.push(
        ...results.filter((item): item is GainerInfo => item !== null)
      );

      // 添加一个短暂延迟以避免 API 请求限制
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // 按涨幅排序并返回前 limit 个
    const sortedGainers = gainersData
      .sort((a, b) => b.priceChangePercent - a.priceChangePercent)
      .slice(0, limit);

    logInfo(`成功获取 ${date} 的历史涨幅榜，共 ${sortedGainers.length} 个币种`);
    return sortedGainers;
  } catch (error) {
    logError(`获取历史涨幅榜数据失败: ${error}`);
    logWarning('使用模拟数据替代');

    // 如果无法获取历史数据，使用当前数据
    return await fetchGainersList(limit);
  }
}
