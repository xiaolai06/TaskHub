const path = require('path');

// 项目根目录（ecosystem.config.js 所在位置）
const ROOT = path.resolve(__dirname);

module.exports = {
  apps: [
    {
      // ===== 后端 API 服务 =====
      name: 'taskflow-api',
      script: 'dist/server.js',
      cwd: path.join(ROOT, 'backend'),
      instances: 1,              // SQLite 单写入，不建议多实例
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      // 日志配置
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      merge_logs: true,
      max_size: '10M',          // 单个日志文件最大 10MB
      retain: 7,                // 保留最近 7 个日志文件

      // 优雅关闭
      kill_timeout: 10000,      // 10 秒后强制 kill
      listen_timeout: 8000,     // 8 秒等待 ready 信号
    },
    {
      // ===== 前端 Next.js 服务 =====
      name: 'taskflow-web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: path.join(ROOT, 'frontend'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      merge_logs: true,
      max_size: '10M',
      retain: 7,
      kill_timeout: 10000,
    },
  ],
};
