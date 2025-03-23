/**
 * 简单监控示例
 *
 * 这个脚本展示了如何使用币安合约反转信号监控系统的基本功能
 */

import { logInfo } from '../src/utils/helpers.ts';
import { notify } from '../src/notifications/notifier.ts';

// 模拟主程序
async function main() {
  logInfo('开始币安合约反转信号监控示例');

  // 模拟获取涨幅榜数据
  const topGainers = [
    { symbol: 'BTCUSDT', priceChange: 5.2, lastPrice: 68500 },
    { symbol: 'ETHUSDT', priceChange: 4.8, lastPrice: 3650 },
    { symbol: 'SOLUSDT', priceChange: 8.3, lastPrice: 178.5 },
  ];

  logInfo(`获取到涨幅榜前 ${topGainers.length} 名币种`);

  // 模拟检测信号
  for (const coin of topGainers) {
    logInfo(`分析 ${coin.symbol}...`);

    // 模拟分析后的结果
    if (coin.symbol === 'SOLUSDT') {
      // 模拟上涨乏力信号
      await notify({
        symbol: coin.symbol,
        probability: 78.5,
        signals: [
          { name: 'RSI 超买', description: 'RSI(14) = 82.3' },
          { name: '量价背离', description: '价格新高但成交量未创新高' },
          { name: 'MACD 死叉', description: 'MACD 线下穿信号线' },
        ],
        price: coin.lastPrice,
        highestPrice: 185.3,
        dropPercent: 3.7,
      });

      // 等待一段时间后模拟确认下跌
      await new Promise((resolve) => setTimeout(resolve, 2000));

      await notify({
        symbol: coin.symbol,
        probability: 92.1,
        signals: [{ name: '趋势确认', description: '价格已从高点下跌超过 5%' }],
        price: 168.2,
        highestPrice: 185.3,
        dropPercent: 9.2,
        message: '确认下跌：SOL 已经从历史高点下跌超过 9%',
      });
    }
  }

  logInfo('监控示例完成');
}

// 运行主程序
if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error('运行示例时发生错误:', error);
  }
}
