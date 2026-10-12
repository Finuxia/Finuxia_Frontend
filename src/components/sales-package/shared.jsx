import { useRef } from "react";
import { formatCurrencyInput } from "../../lib/currency";

export const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30";

export function StepCard({ title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-navy">{title}</h2>
      {subtitle && <p className="mb-4 mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </section>
  );
}

export function FormField({ label, required, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label} {required && <span className="text-av-red">*</span>}
      </span>
      {children}
    </label>
  );
}

// A currency-formatted <input> that preserves the cursor position while
// typing — reformatting on every keystroke (to insert commas as the
// advisor types) otherwise moves the cursor to the end, so typing a digit
// or decimal point anywhere but the very end scrambles the value.
export function CurrencyInput({ value, onChange, className, placeholder, disabled, title }) {
  const ref = useRef(null);
  const handleChange = (e) => {
    const input = e.target;
    const prevCursor = input.selectionStart ?? input.value.length;
    const digitsBeforeCursor = input.value.slice(0, prevCursor).replace(/[^\d.]/g, "").length;
    const formatted = formatCurrencyInput(input.value);
    let seen = 0;
    let cursor = formatted.length;
    for (let i = 0; i < formatted.length; i++) {
      if (/[\d.]/.test(formatted[i])) seen++;
      if (seen >= digitsBeforeCursor) {
        cursor = i + 1;
        break;
      }
    }
    onChange(formatted);
    requestAnimationFrame(() => ref.current?.setSelectionRange(cursor, cursor));
  };
  return (
    <input
      ref={ref}
      inputMode="decimal"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      title={title}
      onChange={handleChange}
      className={className}
    />
  );
}

export function CurrencyField({ label, value, onChange, placeholder }) {
  return (
    <FormField label={label}>
      <CurrencyInput value={value} onChange={onChange} placeholder={placeholder} className={inputClass} />
    </FormField>
  );
}

export function YesNo({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-navy">{label}</span>
      <div className="flex shrink-0 gap-3">
        {[
          ["Yes", true],
          ["No", false],
        ].map(([text, val]) => (
          <label key={text} className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
            <input type="radio" checked={value === val} onChange={() => onChange(val)} className="accent-gold" />
            {text}
          </label>
        ))}
      </div>
    </div>
  );
}

export function SummaryRow({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-navy">{children}</p>
    </div>
  );
}
