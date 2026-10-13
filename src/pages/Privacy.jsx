import Logo from "../components/Logo";
import Footer from "../components/Footer";

export default function Privacy() {
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
          <h1 className="text-xl font-bold text-navy">Privacy Policy</h1>
          <p className="mt-1 text-xs text-slate-400">Last updated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

          <div className="mt-6 flex flex-col gap-5 text-sm leading-relaxed text-slate-600">
            <Section title="What we collect">
              Finuxia is a CRM for financial advisors. We store the client records, notes, meeting history, and
              reminders an advisor enters directly, plus account details (name, email) for the advisor themselves.
            </Section>
            <Section title="Connected third-party accounts">
              If an advisor connects Google Calendar, Google Drive, or Zoom, we store only the OAuth tokens needed
              to act on their behalf (creating calendar events, managing a client-files folder, or creating meeting
              links) — encrypted at rest, never shared with anyone else, and revocable at any time from the
              advisor's Profile page. We request the minimum scopes each integration needs and never read data
              unrelated to the feature it powers.
            </Section>
            <Section title="How we use it">
              Data is used only to run the product for the advisor who entered it: showing their own clients,
              scheduling their own meetings, sending confirmation/reminder emails on their behalf. We do not sell
              or share client data with third parties, and do not use it for advertising.
            </Section>
            <Section title="Your rights">
              An advisor can export, correct, or delete their client data at any time from within the app, or by
              contacting us. Disconnecting a third-party integration immediately revokes our access and deletes the
              stored tokens for it.
            </Section>
            <Section title="Contact">
              Questions about this policy? Reach us at{" "}
              <a href="mailto:info@finuxia.com" className="font-medium text-gold-dark hover:underline">
                info@finuxia.com
              </a>
              .
            </Section>
          </div>
        </div>
      </div>
      <Footer minimal />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="mb-1 text-sm font-semibold text-navy">{title}</h2>
      <p>{children}</p>
    </div>
  );
}
