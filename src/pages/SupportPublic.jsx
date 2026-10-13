import { Mail } from "lucide-react";
import Logo from "../components/Logo";
import Footer from "../components/Footer";

export default function SupportPublic() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:py-16">
        <div className="mb-8 flex items-center justify-center gap-2">
          <Logo size={22} plain />
          <span className="text-base font-bold tracking-tight text-navy">
            Fin<span className="text-gold-dark">uxia</span>
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10 text-gold-dark">
            <Mail size={22} />
          </div>
          <h1 className="text-xl font-bold text-navy">Need help?</h1>
          <p className="mt-2 text-sm text-slate-500">
            Email us any time and we'll get back to you — account questions, integration issues (Google Calendar,
            Google Drive, Zoom), or anything else.
          </p>
          <a
            href="mailto:info@finuxia.com"
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light"
          >
            <Mail size={14} />
            info@finuxia.com
          </a>
          <p className="mt-4 text-xs text-slate-400">
            Already signed in? Use the in-app{" "}
            <a href="/tickets" className="font-medium text-gold-dark hover:underline">
              Support
            </a>{" "}
            page to track a ticket.
          </p>
        </div>
      </div>
      <Footer minimal />
    </div>
  );
}
