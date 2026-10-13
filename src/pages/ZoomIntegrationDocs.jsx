import Logo from "../components/Logo";
import Footer from "../components/Footer";

const STEPS = [
  {
    title: "Connect your Zoom account",
    body: 'In Finuxia, go to Profile → Zoom and click "Connect Zoom." You\'ll be redirected to Zoom to authorize Finuxia, then brought back to your Profile.',
  },
  {
    title: "Use Zoom on a booking link",
    body: 'Open Booking Links → edit (or create) a link → set "Location" to Zoom. Every meeting booked through that link will automatically get its own Zoom meeting and join link.',
  },
  {
    title: "What Finuxia can do with it",
    body: "Create a Zoom meeting when a client books, update its time if the meeting is rescheduled, and delete it if the booking is cancelled. Finuxia never joins or records your meetings — it only manages scheduling.",
  },
  {
    title: "Removing the app",
    body: 'Go to Profile → Zoom and click "Disconnect" — this immediately revokes Finuxia\'s access and deletes the stored connection. You can also revoke access directly from your Zoom App Marketplace account under "Installed Apps."',
  },
];

export default function ZoomIntegrationDocs() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:py-16">
        <div className="mb-8 flex items-center justify-center gap-2">
          <Logo size={22} plain />
          <span className="text-base font-bold tracking-tight text-navy">
            Fin<span className="text-gold-dark">uxia</span>
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <h1 className="text-xl font-bold text-navy">Zoom integration guide</h1>
          <p className="mt-1 text-sm text-slate-500">How connecting Zoom to Finuxia works, what it does, and how to remove it.</p>

          <div className="mt-6 flex flex-col gap-5">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/10 text-xs font-bold text-gold-dark">
                  {i + 1}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-navy">{step.title}</h2>
                  <p className="mt-0.5 text-sm text-slate-600">{step.body}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-400">
            Questions? Email{" "}
            <a href="mailto:info@finuxia.com" className="font-medium text-gold-dark hover:underline">
              info@finuxia.com
            </a>
            .
          </p>
        </div>
      </div>
      <Footer minimal />
    </div>
  );
}
