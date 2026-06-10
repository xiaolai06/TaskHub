'use client';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-bg relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* 流动渐变背景 */}
      <div className="auth-bg__gradient" />
      {/* 呼吸光斑 */}
      <div className="auth-bg__orb auth-bg__orb--1" />
      <div className="auth-bg__orb auth-bg__orb--2" />
      {/* 品牌纹理网格 */}
      <div className="auth-bg__grid" />

      <div className="relative z-10 w-full max-w-lg px-4">
        <div className="rounded-2xl border border-border bg-card/80 p-10 shadow-lg shadow-slate-200/50 backdrop-blur-md transition-shadow duration-300 hover:shadow-xl hover:shadow-slate-200/60 dark:border-border dark:bg-card/85 dark:shadow-none">
          {children}
        </div>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          © 2026 TaskHub
        </p>
      </div>
    </div>
  );
}
