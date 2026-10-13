/** The white rounded panel most screens are built from. `as` changes the element (a section, an article, a list item). */
export default function Card({ as: Tag = "div", padded = true, className = "", children, ...rest }) {
  return (
    <Tag className={`rounded-2xl border border-slate-100 bg-white shadow-sm ${padded ? "p-6" : ""} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
