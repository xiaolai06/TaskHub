export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-100 via-purple-50 to-blue-50">
      {/* 右下角静态装饰虚影 */}
      <div className="pointer-events-none absolute -bottom-32 -right-20 select-none">
        {/* 大虚影圆 */}
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-indigo-300/15 blur-3xl" />
        <div className="absolute bottom-10 right-20 h-48 w-48 rounded-full bg-purple-300/12 blur-2xl" />
        {/* 装饰线条虚影 */}
        <svg
          width="320"
          height="320"
          viewBox="0 0 320 320"
          fill="none"
          className="relative opacity-[0.06]"
        >
          <circle cx="280" cy="280" r="120" stroke="#6366f1" strokeWidth="0.8" />
          <circle cx="280" cy="280" r="80" stroke="#a855f7" strokeWidth="0.6" />
          <circle cx="280" cy="280" r="40" stroke="#6366f1" strokeWidth="0.5" />
          <line x1="280" y1="100" x2="280" y2="220" stroke="#6366f1" strokeWidth="0.6" />
          <line x1="200" y1="280" x2="320" y2="280" stroke="#6366f1" strokeWidth="0.6" />
        </svg>
      </div>

      {/* 左上角小点缀 */}
      <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-indigo-200/15 blur-3xl" />

      {/* 卡片 */}
      <div className="relative z-10 w-full max-w-lg px-4">
        <div className="rounded-2xl border border-white/50 bg-white/85 p-10 shadow-lg shadow-slate-200/50 backdrop-blur-sm transition-shadow duration-300 hover:shadow-xl hover:shadow-slate-200/60">
          {children}
        </div>
        <p className="mt-5 text-center text-xs text-slate-300">
          © 2026 TaskFlow+
        </p>
      </div>
    </div>
  );
}
