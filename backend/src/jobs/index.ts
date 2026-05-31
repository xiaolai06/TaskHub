// 定时任务注册入口
// 每个 job 文件在 import 时通过 node-cron 注册
// startAllCronJobs 由 server.ts 在数据库连接成功后调用

export function startAllCronJobs(): void {
  // 动态 require 确保依赖已加载
  require('./due-reminder.job');
  require('./cost-alert.job');
  require('./morning-briefing.job');
  require('./client-radar.job');
  require('./finance-pulse.job');
  require('./weekly-report.job');
  require('./weekly-memory.job');
  require('./health-check.job');
  console.log('⏰ 定时任务已全部注册 (8 个 Job)');
}
