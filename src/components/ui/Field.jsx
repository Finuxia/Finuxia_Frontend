import { cloneElement, isValidElement, useId } from "react";

/**
 * A labelled form control. The label is tied to the control (so a screen reader reads it and a click on it focuses the control), a required field is
 * marked, and an error is shown under the control and announced.
 *
 *   <Field label="Title" required error={errors.title}><Input value={title} onChange={...} /></Field>
 *
 * The child must be a single element; it gets the id and the aria attributes. For a group of controls use a fieldset instead.
 */
export default function Field({ label, required = false, error, hint, children }) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  // Our own controls (Input, Select) take `invalid`; a plain DOM element gets the aria attribute directly.
  const own = isValidElement(children) && typeof children.type !== "string";
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id ?? id,
        "aria-describedby": describedBy,
        ...(own ? { invalid: Boolean(error) || undefined } : { "aria-invalid": error ? true : undefined }),
      })
    : children;
  const controlId = isValidElement(children) ? (children.props.id ?? id) : id;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={controlId} className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
        {required && <span className="text-av-red"> *</span>}
      </label>
      {control}
      {hint && !error && (
        <span id={hintId} className="text-xs text-slate-400">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} role="alert" className="text-xs text-av-red">
          {error}
        </span>
      )}
    </div>
  );
}
