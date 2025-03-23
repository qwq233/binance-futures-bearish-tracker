/**
 * 币安合约反转信号监控系统 - 数据模型类型定义
 */

/**
 * 涨幅榜币种信息
 */
export interface GainerInfo {
  symbol: string; // 交易对名称
  priceChange: number; // 价格变动
  priceChangePercent: number; // 价格变动百分比
  lastPrice: number; // 最新价格
  volume: number; // 成交量
  quoteVolume: number; // 成交额
}

/**
 * 反转信号类型枚举
 */
export enum SignalType {
  RSI_OVERBOUGHT = 'RSI 超买',
  MACD_BEARISH_CROSS = 'MACD 死叉',
  VOLUME_PRICE_DIVERGENCE = '量价背离',
  BEARISH_CANDLESTICK = '看跌 K 线形态',
  MOVING_AVERAGE_DEATH_CROSS = '均线死叉',
  SUPPORT_BREAK = '支撑位破位',
  BEARISH_ENGULFING = '看跌吞没形态',
  EVENING_STAR = '黄昏星形态',
  FUND_OUTFLOW = '资金流出',
}

/**
 * 信号接口
 */
export interface Signal {
  name: string; // 信号名称
  description: string; // 信号描述
  strength: number; // 信号强度 (0-100)
}

/**
 * 技术分析结果接口
 */
export interface AnalysisResult {
  symbol: string; // 币种符号
  price: number; // 当前价格
  probability: number; // 反转概率 (0-100)
  signals: Signal[]; // 检测到的信号列表
  timeframe?: string; // 时间周期 (可选)
  timestamp?: number; // 时间戳 (可选)
  highestPrice?: number; // 历史最高价格 (用于回测和监控系统)
  dropPercent?: number; // 从高点下跌百分比 (用于回测和监控系统)
}

/**
 * 通知内容
 */
export interface Notification {
  symbol: string; // 交易对名称
  probability: number; // 反转概率
  signals: Signal[]; // 检测到的信号列表
  price: number; // 当前价格
}

/**
 * K 线数据
 */
export interface Candle {
  open: number; // 开盘价
  high: number; // 最高价
  low: number; // 最低价
  close: number; // 收盘价
  volume: number; // 成交量
  closeTime: number; // 收盘时间戳
}

/**
 * 技术指标计算结果
 */
export interface IndicatorValues {
  rsi: number; // RSI 值
  macd: {
    // MACD 值
    macd: number; // MACD 线
    signal: number; // 信号线
    histogram: number; // 柱状图
  };
  bollingerBands: {
    // 布林带
    upper: number; // 上轨
    middle: number; // 中轨
    lower: number; // 下轨
  };
  movingAverages: {
    // 移动平均线
    ma7: number; // 7 周期均线
    ma25: number; // 25 周期均线
    ma99: number; // 99 周期均线
  };
}

/**
 * 通知消息结构
 */
export interface NotificationMessage {
  symbol: string; // 交易对名称
  probability: number; // 反转概率
  signals: any[]; // 反转信号列表
  price: number; // 当前价格
  timestamp?: number; // 时间戳
  dropPercent?: number; // 从高点下跌的百分比
  highestPrice?: number; // 历史最高价格
}

/**
 * 跟踪币种的状态接口
 */
export interface TrackedSymbol {
  symbol: string; // 币种符号
  lastPrice: number; // 最新价格
  highestPrice: number; // 历史最高价格
  lastUpdateTime: number; // 最后更新时间
  signals: Signal[]; // 信号列表
  downtrend: boolean; // 是否处于下跌趋势
  downtrendConfirmed: boolean; // 是否确认下跌
  downtrendNotified: boolean; // 是否已发送下跌通知
}
