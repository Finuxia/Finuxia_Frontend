import Logo from "../components/Logo";
import Footer from "../components/Footer";

export default function Terms() {
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
          <h1 className="text-xl font-bold text-navy">Terms of Use</h1>
          <p className="mt-1 text-xs text-slate-400">Last updated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

          <div className="mt-6 flex flex-col gap-5 text-sm leading-relaxed text-slate-600">
            <Section title="Using Finuxia">
              Finuxia is provided to licensed financial advisors and their teams to manage clients, meetings, and
              follow-ups. By using the app you agree to use it only for legitimate business purposes and to keep
              your account credentials confidential.
            </Section>
            <Section title="Your data">
              You retain ownership of the client and business data you enter. We act only as the platform that
              stores and displays it back to you, and to any third-party service (Google, Zoom) you explicitly
              connect.
            </Section>
            <Section title="Third-party integrations">
              Connecting Google Calendar, Google Drive, or Zoom is optional and can be disconnected at any time.
              You're responsible for complying with each provider's own terms of service when connecting your
              account.
            </Section>
            <Section title="Availability">
              We aim to keep Finuxia available and reliable, but the service is provided "as is" without warranty
              of uninterrupted availability. We are not liable for indirect or consequential damages arising from
              use of the app.
            </Section>
            <Section title="Changes">
              We may update these terms from time to time; continued use of Finuxia after a change means you accept
              the updated terms.
            </Section>
            <Section title="Contact">
              Questions about these terms? Reach us at{" "}
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
