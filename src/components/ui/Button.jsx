const VARIANTS = {
  primary: "bg-navy text-white shadow-sm hover:bg-navy-light",
  secondary: "border border-slate-200 bg-white text-navy hover:bg-slate-50",
  gold: "bg-gold text-navy hover:bg-gold-dark hover:text-white",
  danger: "border border-av-red/30 text-av-red hover:bg-av-red/5",
  ghost: "text-slate-500 hover:bg-slate-50 hover:text-navy",
};
const SIZES = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };

/**
 * A button in the brand colours. It never submits a form by accident (`type` defaults to "button"; pass type="submit" where it should), and `busy`
 * disables it and shows `busyLabel` (if given) while a request is in flight, so a double click cannot send twice.
 *
 *   <Button variant="primary" busy={saving} busyLabel="Saving...">Save</Button>
 */
export default function Button({
  variant = "primary",
  size = "md",
  busy = false,
  busyLabel,
  disabled = false,
  type = "button",
  className = "",
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant] ?? VARIANTS.primary} ${SIZES[size] ?? SIZES.md} ${className}`}
      {...rest}
    >
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}
