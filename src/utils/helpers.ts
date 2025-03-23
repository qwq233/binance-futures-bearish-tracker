/**
 * 辅助工具函数
 */

/**
 * 格式化价格显示
 *
 * @param price 价格
 * @param digits 小数位数
 * @returns 格式化后的价格字符串
 */
export function formatPrice(price: number, digits = 4): string {
  return price.toFixed(digits);
}

/**
 * 计算百分比变化
 *
 * @param current 当前值
 * @param previous 先前值
 * @returns 百分比变化
 */
export function calculatePercentChange(
  current: number,
  previous: number
): number {
  if (previous === 0) {
    return 0;
  }

  return ((current - previous) / previous) * 100;
}

/**
 * 延迟指定时间
 *
 * @param ms 毫秒数
 * @returns Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带重试的异步函数执行
 *
 * @param fn 要执行的异步函数
 * @param retries 重试次数
 * @param delayMs 重试间隔
 * @returns 函数执行结果
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`执行失败，${i + 1}/${retries} 次重试:`, error);

      if (i < retries - 1) {
        await delay(delayMs);
      }
    }
  }

  throw lastError;
}

/**
 * 解析和验证环境变量
 *
 * @param name 环境变量名
 * @param defaultValue 默认值
 * @returns 环境变量值
 */
export function env(name: string, defaultValue?: string): string {
  const value = Deno.env.get(name);

  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }

    throw new Error(`必需的环境变量 ${name} 未设置`);
  }

  return value;
}

/**
 * 简单的日志记录函数
 *
 * @param level 日志级别
 * @param message 日志消息
 * @param data 附加数据
 */
export function log(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  data?: unknown
): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  if (data !== undefined) {
    console[level](`${prefix} ${message}`, data);
  } else {
    console[level](`${prefix} ${message}`);
  }
}

/**
 * 格式化数字
 *
 * @param num 需要格式化的数字
 * @param precision 精度，默认为 2
 * @returns 格式化后的数字字符串
 */
export function formatNumber(num: number, precision = 2): string {
  return num.toFixed(precision);
}

/**
 * 格式化百分比
 *
 * @param percent 百分比值 (0.01 = 1%)
 * @param precision 精度，默认为 2
 * @returns 格式化后的百分比字符串
 */
export function formatPercent(percent: number, precision = 2): string {
  return `${(percent * 100).toFixed(precision)}%`;
}

/**
 * 计算两个数值之间的百分比变化
 *
 * @param from 起始值
 * @param to 目标值
 * @returns 百分比变化
 */
export function percentChange(from: number, to: number): number {
  return (to - from) / from;
}

/**
 * 输出普通日志信息
 *
 * @param message 日志消息
 */
export function logInfo(message: string): void {
  console.log(`ℹ️ ${message}`);
}

/**
 * 输出成功日志信息
 *
 * @param message 日志消息
 */
export function logSuccess(message: string): void {
  console.log(`✅ ${message}`);
}

/**
 * 输出警告日志信息
 *
 * @param message 日志消息
 */
export function logWarning(message: string): void {
  console.log(`⚠️ ${message}`);
}

/**
 * 输出错误日志信息
 *
 * @param message 日志消息
 */
export function logError(message: string): void {
  console.log(`❌ ${message}`);
}

/**
 * 生成唯一 ID
 *
 * @returns 唯一 ID 字符串
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
