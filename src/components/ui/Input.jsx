const BASE =
  "w-full rounded-lg border px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30";

/** The class string of a text control, for the places that need a class and not a component. `invalid` turns the border red. */
export function inputClass(invalid = false) {
  return `${BASE} ${invalid ? "border-av-red" : "border-slate-200"}`;
}

/** A text input in the brand style. `invalid` marks it for assistive technology as well as turning the border red. */
export default function Input({ invalid = false, className = "", ...rest }) {
  return <input aria-invalid={invalid || undefined} className={`${inputClass(invalid)} ${className}`} {...rest} />;
}

/** The class string of an ordinary (valid) text control, for the many places that put it in a className as a constant. */
export const INPUT_CLASS = inputClass();
