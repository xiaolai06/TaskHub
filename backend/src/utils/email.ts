import nodemailer from 'nodemailer';
import { config } from '../config';

const { smtp } = config;

/** 懒初始化 transporter（单例，避免每次发邮件重新连接） */
let _transporter: nodemailer.Transporter | null = null;
let _transporterReady = false;

function getTransporter(): nodemailer.Transporter | null {
  if (_transporterReady) return _transporter;
  _transporterReady = true;

  if (!smtp.host || !smtp.user || !smtp.pass) {
    console.error('[Email] ❌ SMTP 未配置！请在 .env 中设置 SMTP_HOST / SMTP_USER / SMTP_PASS');
    return null;
  }

  _transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
    pool: true,        // 连接池，复用连接
    maxConnections: 3,
    maxMessages: 100,
  });

  return _transporter;
}

/**
 * 发送密码重置验证码邮件
 * @throws 邮件发送失败时抛出异常，由调用方处理
 */
export async function sendResetCode(toEmail: string, code: string): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error('邮件服务未配置，无法发送验证码。请联系管理员配置 SMTP。');
  }

  await transporter.sendMail({
    from: `"TaskHub" <${smtp.user}>`,
    to: toEmail,
    subject: '【TaskHub】密码重置验证码',
    html: `
      <div style="max-width:480px;margin:0 auto;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif;">
        <h2 style="color:#1a1a2e;font-size:20px;margin-bottom:8px;">密码重置验证码</h2>
        <p style="color:#5a5a78;font-size:14px;margin-bottom:24px;">
          你正在重置 TaskHub 账户密码，请在 <strong>10 分钟</strong>内输入以下验证码：
        </p>
        <div style="background:#f8f9fb;border:2px dashed #e5e7eb;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
          <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#6c63ff;font-family:monospace;">
            ${code}
          </span>
        </div>
        <p style="color:#999;font-size:12px;">
          如果这不是你本人的操作，请忽略此邮件，你的密码不会被更改。
        </p>
      </div>
    `,
  });
}
