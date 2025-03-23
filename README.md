# 币安合约反转信号监控系统

[![GitHub Actions](https://github.com/chachako/binance-futures-bearish-tracker/actions/workflows/monitor.yml/badge.svg)](https://github.com/chachako/binance-futures-bearish-tracker/actions/workflows/monitor.yml)

一个自动监控币安永续合约市场涨幅榜的系统，基于技术分析指标检测潜在的趋势反转信号，并通过 Telegram 发送实时警报。

## 📋 功能概述

- **自动监控**：每小时自动获取币安合约市场涨幅榜前 20 名币种
- **持续跟踪**：记录每个币种的历史高点和价格变动
- **多指标分析**：集成 RSI、MACD、布林带等多种技术指标
- **智能警报**：识别两种关键信号
  - **上涨乏力信号**：当币种不再创造新高且技术指标显示潜在反转
  - **确认下跌信号**：当币种从历史高点下跌超过 5%
- **通知系统**：支持控制台输出和 Telegram 通知
- **历史回测**：验证信号在历史数据上的准确性
- **自动化部署**：通过 GitHub Actions 每小时自动运行

## 🚀 快速开始

### 安装

1. 克隆项目：

```bash
git clone https://github.com/chachako/binance-futures-bearish-tracker.git
cd binance-futures-bearish-tracker
```

2. 初始化环境：

```bash
# 确保 Deno 已安装
deno --version
```

### 运行

启动监控系统：

```bash
deno task start
```

系统将：
1. 初始化必要的数据目录
2. 获取涨幅榜前 20 名币种并开始跟踪
3. 分析技术指标并检测潜在反转信号
4. 显示警报并保存跟踪数据

### 回测

运行回测系统：

```bash
# ⚠️ 必须指定起始日期
deno task backtest --start-date=2025-01-01

# 同时指定起始日期和结束日期（默认结束日期为当前日期）
deno task backtest --start-date=2025-01-01 --end-date=2025-01-31
```

回测模式将从指定日期开始，使用历史数据验证系统的信号生成能力。

## 🔍 工作原理

### 监控流程

1. **初始化**：系统启动后获取币安合约市场涨幅榜前 20 名币种
2. **持续跟踪**：每小时更新一次数据，并持续记录每个币种的历史高点
3. **分析**：对每个币种进行技术指标分析，计算反转概率
4. **警报触发条件**：
   - **上涨乏力信号**：当币种价格低于历史高点且技术指标显示潜在反转（概率 > 70%）
   - **确认下跌信号**：当币种价格从历史高点下跌超过 5%
5. **数据持久化**：所有跟踪状态保存到本地文件，以便系统重启后恢复
6. **清理**：超过 7 天未更新的币种将从跟踪列表中删除

### 技术指标

系统使用以下技术指标分析潜在反转：

- **RSI 超买**：RSI > 70 表明可能超买
- **布林带上轨**：价格接近或突破上轨可能反转
- **量价关系分析**：价格上涨但成交量减少，表明上升动力不足
- **MACD 死叉**：MACD 线下穿信号线，表明动能减弱
- **移动平均线死叉**：短期均线向下穿越长期均线
- **K 线形态识别**：识别多种看跌形态

## 📊 通知系统

### Telegram 通知

系统支持通过 Telegram 发送实时警报：

1. 在 Telegram 中创建一个机器人（使用 [@BotFather](https://t.me/botfather)）
2. 获取机器人的 API 令牌和聊天 ID
3. 设置环境变量：
   ```
   ENABLE_TELEGRAM=true
   TELEGRAM_BOT_TOKEN=your_bot_token
   TELEGRAM_CHAT_ID=your_chat_id
   ```

详细的 Telegram 设置指南请参考 [Telegram 通知设置指南](docs/telegram-setup.md)。

### 示例脚本

可以运行示例脚本测试通知功能：

```bash
deno task example
```

## 🤖 自动化部署

系统可以通过 GitHub Actions 自动运行：

1. Fork 此仓库
2. 在仓库设置中设置以下 Secrets：
   - `TELEGRAM_BOT_TOKEN`：Telegram 机器人令牌
   - `TELEGRAM_CHAT_ID`：接收通知的聊天 ID
   - `ENABLE_TELEGRAM`：设置为 "true" 启用 Telegram 通知
3. GitHub Actions 将每小时自动运行系统并将结果保存到仓库

## 📁 目录结构

```
/
├── .github/workflows/     # GitHub Actions 配置
├── src/                   # 源代码
│   ├── api/               # 币安 API 交互
│   ├── indicators/        # 技术指标计算
│   ├── models/            # 数据模型定义
│   ├── notifications/     # 通知系统
│   ├── utils/             # 工具函数
│   └── backtest/          # 回测系统
├── data/                  # 数据存储
│   ├── history/           # 历史价格数据
│   ├── analysis/          # 分析结果
│   └── backtest/          # 回测结果
└── deno.json              # Deno 配置文件
```

## ⚠️ 免责声明

本系统仅供学习和研究使用，不构成投资建议。加密货币市场风险高，投资需谨慎。使用此系统进行实际交易风险自负。

## 📄 许可证

[MIT](LICENSE)