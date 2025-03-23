/**
 * 通知模块
 *
 * 处理各种通知功能
 */

import { Signal } from '../models/types.ts';
import { logInfo, logError } from '../utils/helpers.ts';
import { sendTelegramNotification } from '../utils/notification.ts';

/**
 * 通知消息接口
 */
export interface NotificationMessage {
  symbol: string;
  probability: number;
  signals: any[]; // 可以是 Signal[] 或 string[] 等
  price: number;
  message?: string; // 可选的自定义消息
  highestPrice?: number; // 历史最高价格
  dropPercent?: number; // 从高点下跌百分比
}

/**
 * 发送通知
 *
 * 将反转信号通知发送到控制台和其他配置的通知渠道
 *
 * @param data 通知数据
 */
export async function notify(data: NotificationMessage): Promise<void> {
  // 控制台通知
  consoleNotify(data);

  // Telegram 通知
  await telegramNotify(data);
}

/**
 * 控制台通知
 *
 * 将信号通知输出到控制台
 *
 * @param data 通知数据
 */
function consoleNotify(data: NotificationMessage): void {
  const { symbol, probability, signals, price, message } = data;

  // 构建信号列表字符串
  let signalsList = '';
  if (signals && signals.length > 0) {
    signalsList = signals
      .map((s) => (typeof s === 'string' ? s : s.name))
      .join(', ');
  }

  // 输出自定义消息或默认格式
  if (message) {
    logInfo(`📢 ${symbol} @ ${price}: ${message}`);
  } else {
    logInfo(
      `📢 信号通知: ${symbol} 检测到潜在反转，概率 ${probability.toFixed(
        2
      )}%, 当前价格: ${price}`
    );

    if (signalsList) {
      logInfo(`   信号: ${signalsList}`);
    }
  }
}

/**
 * Telegram 通知
 *
 * 将信号通知发送到 Telegram
 *
 * @param data 通知数据
 */
async function telegramNotify(data: NotificationMessage): Promise<void> {
  try {
    const {
      symbol,
      probability,
      signals,
      price,
      message,
      highestPrice,
      dropPercent,
    } = data;

    // 构建信号列表字符串
    let signalsList = '';
    if (signals && signals.length > 0) {
      signalsList = signals
        .map((s) =>
          typeof s === 'string' ? s : `${s.name}: ${s.description || ''}`
        )
        .join('\n- ');

      if (signalsList) {
        signalsList = `- ${signalsList}`;
      }
    }

    // 根据是否是确认下跌构建不同样式的消息
    let telegramMessage;

    if (message && message.includes('确认下跌')) {
      telegramMessage = `📉 <b>确认下跌警报</b> 📉\n\n`;
      telegramMessage += `<b>${symbol}</b> 已确认下跌趋势!\n`;

      if (highestPrice) {
        telegramMessage += `历史高点: ${highestPrice}\n`;
      }

      telegramMessage += `当前价格: ${price}\n`;

      if (dropPercent) {
        telegramMessage += `跌幅: <b>${dropPercent.toFixed(2)}%</b>\n`;
      }

      if (signalsList) {
        telegramMessage += `\n信号:\n${signalsList}\n`;
      }
    } else {
      telegramMessage = `🚨 <b>上涨乏力警报</b> 🚨\n\n`;
      telegramMessage += `<b>${symbol}</b> 检测到潜在反转信号!\n`;
      telegramMessage += `反转概率: <b>${probability.toFixed(2)}%</b>\n`;
      telegramMessage += `当前价格: ${price}\n`;

      if (highestPrice) {
        telegramMessage += `历史高点: ${highestPrice}\n`;
      }

      if (dropPercent) {
        telegramMessage += `距离高点: ${dropPercent.toFixed(2)}%\n`;
      }

      if (signalsList) {
        telegramMessage += `\n信号:\n${signalsList}\n`;
      }
    }

    telegramMessage += `\n<i>时间: ${new Date().toLocaleString()}</i>`;

    // 发送到 Telegram
    await sendTelegramNotification(telegramMessage);
  } catch (error) {
    logError(`发送 Telegram 通知失败: ${error}`);
  }
}

// 这里可以添加更多的通知方法，如 Webhook、邮件等
