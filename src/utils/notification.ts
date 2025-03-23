/**
 * 通知工具模块
 *
 * 负责发送各种类型的通知
 */

import { NotificationMessage } from '../models/types.ts';
import { logInfo, logError } from './helpers.ts';

// Telegram Bot 配置
interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

// 从环境变量获取 Telegram 配置
const telegramConfig: TelegramConfig = {
  botToken: Deno.env.get('TELEGRAM_BOT_TOKEN') || '',
  chatId: Deno.env.get('TELEGRAM_CHAT_ID') || '',
  enabled: Boolean(Deno.env.get('ENABLE_TELEGRAM') === 'true'),
};

/**
 * 发送 Telegram 通知
 *
 * @param message 通知消息
 * @returns 是否发送成功
 */
export async function sendTelegramNotification(
  message: string
): Promise<boolean> {
  if (
    !telegramConfig.enabled ||
    !telegramConfig.botToken ||
    !telegramConfig.chatId
  ) {
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: telegramConfig.chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logError(`发送 Telegram 通知失败: ${error}`);
      return false;
    }

    logInfo('Telegram 通知发送成功');
    return true;
  } catch (error) {
    logError(`发送 Telegram 通知出错: ${error}`);
    return false;
  }
}

/**
 * 格式化上涨乏力通知
 *
 * @param signals 上涨乏力信号列表
 * @returns 格式化后的消息
 */
export function formatUptrendFailureNotification(
  signals: NotificationMessage[]
): string {
  if (signals.length === 0) {
    return '';
  }

  let message = '🚨 <b>上涨乏力信号警报</b> 🚨\n\n';

  signals.forEach((signal, index) => {
    message += `${index + 1}. <b>${
      signal.symbol
    }</b>: 反转概率 ${signal.probability.toFixed(2)}%\n`;
    message += `   当前价格: ${signal.price}\n`;
    if (signal.signals && signal.signals.length > 0) {
      message += '   信号:\n';
      signal.signals.forEach((s) => {
        message += `   - ${s.name}: ${s.description}\n`;
      });
    }
    message += '\n';
  });

  message += `<i>检测时间: ${new Date().toLocaleString()}</i>`;
  return message;
}

/**
 * 格式化确认下跌通知
 *
 * @param signals 确认下跌信号列表
 * @returns 格式化后的消息
 */
export function formatDowntrendConfirmedNotification(
  signals: NotificationMessage[]
): string {
  if (signals.length === 0) {
    return '';
  }

  let message = '📉 <b>确认下跌趋势警报</b> 📉\n\n';

  signals.forEach((signal, index) => {
    // 计算从高点的下跌百分比
    const dropPercent = signal.dropPercent || 0;

    message += `${index + 1}. <b>${
      signal.symbol
    }</b>: 下跌 ${dropPercent.toFixed(2)}%\n`;
    message += `   当前价格: ${signal.price}\n`;
    message += `   历史高点: ${signal.highestPrice}\n`;
    if (signal.signals && signal.signals.length > 0) {
      message += '   信号:\n';
      signal.signals.forEach((s) => {
        message += `   - ${s.name}: ${s.description}\n`;
      });
    }
    message += '\n';
  });

  message += `<i>检测时间: ${new Date().toLocaleString()}</i>`;
  return message;
}
