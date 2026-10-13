/**
 * An on/off switch (a checkbox styled as a toggle). The visible text next to it is separate markup, so the switch
 * carries its own accessible name through `label`.
 *
 *   <Switch label="Allow guests" checked={allowed} onChange={(e) => setAllowed(e.target.checked)} />
 */
export default function Switch({ label, checked, onChange, disabled = false }) {
  return (
    <label className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center">
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="peer sr-only"
      />
      <span className="absolute inset-0 rounded-full bg-slate-200 transition-colors peer-checked:bg-gold" />
      <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
    </label>
  );
}
