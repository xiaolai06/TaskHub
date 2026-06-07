'use client';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 via-slate-50 to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />

      <div className="relative z-10 w-full max-w-lg px-4">
        <div className="rounded-2xl border border-border bg-card/85 p-10 shadow-lg shadow-slate-200/50 backdrop-blur-sm transition-shadow duration-300 hover:shadow-xl hover:shadow-slate-200/60 dark:border-border dark:bg-card/90 dark:shadow-none">
          {children}
        </div>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          © 2025 TaskHub
        </p>
      </div>
    </div>
  );
}
