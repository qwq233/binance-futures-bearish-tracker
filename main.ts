#!/usr/bin/env -S deno run

/**
 * 币安合约反转信号监控系统
 *
 * 主程序入口文件，负责初始化和启动监控服务
 */

import { startMonitoring } from './src/index.ts';

console.log('启动币安合约反转信号监控系统...');

// 启动监控系统
await startMonitoring();
