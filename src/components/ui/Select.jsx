import { inputClass } from "./Input";

/** A native select in the same style as Input. Children are the <option>s. */
export default function Select({ invalid = false, className = "", children, ...rest }) {
  return (
    <select aria-invalid={invalid || undefined} className={`${inputClass(invalid)} bg-white ${className}`} {...rest}>
      {children}
    </select>
  );
}
