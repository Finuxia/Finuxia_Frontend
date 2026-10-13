// The Finuxia mark — the real brand asset (public/logo-icon.png), not a
// recolorable vector glyph. Because the mark itself is already navy+gold,
// dropping it straight onto a solid navy or solid gold box buries half of it
// against its own background; a small white chip behind it keeps full
// contrast there — navy header bar, gold button, a colored hero section.
// On a surface that's already light (the slate-50 login/subscribe/booking
// pages), that same chip just reads as a stray white square, so pass
// `plain` there to render the mark with no chip at all.
export default function Logo({ size = 18, className = "", plain = false }) {
  if (plain) {
    return (
      <img src="/logo-icon.png" alt="Finuxia" width={size} height={size} className={`shrink-0 ${className}`} style={{ display: "block" }} />
    );
  }
  const pad = Math.max(2, Math.round(size * 0.12));
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md bg-white ${className}`}
      style={{ width: size + pad * 2, height: size + pad * 2, padding: pad }}
    >
      <img src="/logo-icon.png" alt="Finuxia" width={size} height={size} style={{ display: "block" }} />
    </span>
  );
}
