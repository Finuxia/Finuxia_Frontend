import Logo from "./Logo";
import Footer from "./Footer";

export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center gap-2">
            <Logo size={26} plain />
            <span className="text-lg font-bold tracking-tight text-navy">
              Fin<span className="text-gold-dark">uxia</span>
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
            <h1 className="text-xl font-bold text-navy">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>

          {footer && <div className="mt-5 text-center text-sm text-slate-500">{footer}</div>}
        </div>
      </div>
      <Footer minimal />
    </div>
  );
}

export function AuthField({ label, error, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {error && <span className="text-xs text-av-red">{error}</span>}
    </label>
  );
}

export function authInputClass(error) {
  return `w-full rounded-lg border px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 ${
    error ? "border-av-red" : "border-slate-200"
  }`;
}
