/**
 * An accessible table that scrolls sideways on a narrow screen instead of squeezing its columns. Columns are described, rows are data:
 *
 *   <Table caption="Recent AI use" columns={[{ key: "label", header: "Feature" }, { key: "credits", header: "Credits", align: "right" }]} rows={rows} rowKey="id" />
 *
 * A column can have `render(row)` for a custom cell. `empty` is shown when there are no rows.
 */
export default function Table({ caption, columns, rows, rowKey = "id", empty = "Nothing to show.", className = "" }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`px-3 py-2 font-medium ${c.align === "right" ? "text-right" : ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-slate-400">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row[rowKey]}>
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2 text-navy ${c.align === "right" ? "text-right" : ""}`}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
