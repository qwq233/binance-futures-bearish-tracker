# Telegram 通知设置指南

本文档介绍如何为币安合约反转信号监控系统设置 Telegram 通知。

## 创建 Telegram 机器人

1. 在 Telegram 中搜索 [@BotFather](https://t.me/botfather) 并开始对话
2. 发送 `/newbot` 命令
3. 为你的机器人提供名称（这是显示名称）
4. 为你的机器人提供用户名（必须以 "bot" 结尾，如 `my_signals_bot`）
5. BotFather 将提供一个 API 令牌，格式类似：`123456789:ABCDefGhIJKlmNoPQRsTUVwxyZ`
6. **重要**：请妥善保存此令牌！

## 获取聊天 ID

有两种方法可以获取你的聊天 ID：

### 方法 1：使用 @userinfobot

1. 在 Telegram 中搜索 [@userinfobot](https://t.me/userinfobot) 并开始对话
2. 机器人会自动回复你的用户 ID，格式类似：`Your user ID: 123456789`

### 方法 2：为频道或群组创建通知

如果你想在群组或频道中接收通知：

1. 创建一个群组或频道
2. 将你的机器人添加为管理员
3. 发送一条测试消息到该群组或频道
4. 访问 `https://api.telegram.org/bot<你的机器人令牌>/getUpdates`
5. 在返回的 JSON 中，找到 `chat` 对象，其中的 `id` 字段即为聊天 ID

对于群组或频道，聊天 ID 通常为负数，如 `-1001234567890`。

## 配置系统

### 使用环境变量

在运行系统时，设置以下环境变量：

```bash
export ENABLE_TELEGRAM=true
export TELEGRAM_BOT_TOKEN=你的机器人令牌
export TELEGRAM_CHAT_ID=你的聊天ID

# 然后运行系统
deno task start
```

### 使用 GitHub Actions

如果你通过 GitHub Actions 部署，需要在仓库中设置以下 Secrets：

1. 打开仓库页面，点击 "Settings" → "Secrets and variables" → "Actions"
2. 添加以下 Repository secrets：
   - `ENABLE_TELEGRAM`: 设置为 `true`
   - `TELEGRAM_BOT_TOKEN`: 你的机器人令牌
   - `TELEGRAM_CHAT_ID`: 你的聊天 ID

## 测试通知

可以运行示例脚本测试通知是否正常工作：

```bash
deno task example
```

如果一切正常，你应该在 Telegram 中收到测试通知。

## 通知内容格式

系统发送两种主要通知：

### 1. 上涨乏力信号

当检测到币种可能开始反转时发送：

```
🚨 上涨乏力警报 🚨

SOLUSDT 检测到潜在反转信号!
反转概率: 78.50%
当前价格: 178.5
历史高点: 185.3
距离高点: 3.70%

信号:
- RSI 超买: RSI(14) = 82.3
- 量价背离: 价格新高但成交量未创新高
- MACD 死叉: MACD 线下穿信号线

时间: 2023-03-23 14:30:00
```

### 2. 确认下跌信号

当币种从高点下跌确认趋势反转时发送：

```
📉 确认下跌警报 📉

SOLUSDT 已确认下跌趋势!
历史高点: 185.3
当前价格: 168.2
跌幅: 9.20%

信号:
- 趋势确认: 价格已从高点下跌超过 5%

时间: 2023-03-23 14:35:00
```

## 故障排除

如果通知未能发送，请检查：

1. `ENABLE_TELEGRAM` 是否设置为 `true`
2. 机器人令牌格式是否正确
3. 聊天 ID 是否正确
4. 对于群组/频道，确保机器人具有发送消息的权限
5. 查看控制台日志中是否有错误消息

如果仍然遇到问题，可以检查 `data/logs/` 目录下的日志文件以获取更多信息。 