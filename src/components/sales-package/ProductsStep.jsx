import { Plus, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import SearchableSelect from "../ui/SearchableSelect";
import { ACCOUNT_TYPES, FREQUENCIES, INVESTMENT_BEARING_TYPES } from "../../lib/salesPackageOptions";
import { StepCard, CurrencyInput } from "./shared";

export default function ProductsStep({
  data,
  companies,
  productsByCompany,
  fundsByKey,
  onAddProduct,
  onRemoveProduct,
  onCompanyChange,
  onProductChange,
  onFieldChange,
  onAddAllocation,
  onUpdateAllocation,
  onRemoveAllocation,
}) {
  return (
    <StepCard title="Products Sold / Recommended" subtitle="Add all products for this client.">
      <div className="flex flex-col gap-3">
        {data.products.map((p) => {
          const products = productsByCompany[p.companyId] || [];
          const isInvestmentBearing = INVESTMENT_BEARING_TYPES.has(p.type);
          const fundKey = `${p.companyId}-${p.type}`;
          const funds = fundsByKey[fundKey] || [];
          const total = p.allocations.reduce((sum, a) => sum + (parseFloat(a.allocationPct) || 0), 0);
          return (
            <div key={p.id} className="rounded-xl border border-slate-200 p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-center">
                <select
                  value={p.companyId}
                  onChange={(e) => onCompanyChange(p.id, e.target.value)}
                  className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold sm:col-span-3"
                >
                  <option value="">Select Company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={p.productId}
                  onChange={(e) => onProductChange(p.id, e.target.value)}
                  disabled={!p.companyId}
                  className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold disabled:bg-slate-50 disabled:text-slate-400 sm:col-span-3"
                >
                  <option value="">{p.companyId ? "Select Product" : "Pick a company first"}</option>
                  {products.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name}
                    </option>
                  ))}
                </select>
                <CurrencyInput
                  value={p.coverageAmount}
                  onChange={(v) => onFieldChange(p.id, { coverageAmount: v })}
                  placeholder="Face Amount"
                  className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold sm:col-span-2"
                />
                <select
                  value={p.frequency}
                  onChange={(e) => onFieldChange(p.id, { frequency: e.target.value })}
                  className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold sm:col-span-2"
                >
                  <option value="">Frequency</option>
                  {FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <CurrencyInput
                  value={p.premium}
                  disabled={!p.frequency}
                  onChange={(v) => onFieldChange(p.id, { premium: v })}
                  placeholder={p.frequency ? "Premium" : "Pick frequency"}
                  title={p.frequency ? undefined : "Select a frequency first"}
                  className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold disabled:bg-slate-50 disabled:text-slate-400 sm:col-span-1"
                />
                <button
                  type="button"
                  onClick={() => onRemoveProduct(p.id)}
                  className="flex items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-av-red/10 hover:text-av-red sm:col-span-1"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Fund allocation — rendered immediately under THIS product's own
                  row, never in a separate section, so it's unambiguous which
                  product each allocation belongs to. */}
              {p.type === "segregated_fund" && (
                <label className="mt-3 flex max-w-xs flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Account Type <span className="text-av-red">*</span>
                  </span>
                  <select
                    value={p.accountType || ""}
                    onChange={(e) => onFieldChange(p.id, { accountType: e.target.value })}
                    className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold"
                  >
                    <option value="">Select account type...</option>
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {isInvestmentBearing && (
                <div className="mt-3 rounded-lg bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fund Allocation — {p.productName}</span>
                    <span
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${Math.abs(total - 100) < 0.01 ? "bg-av-green/10 text-av-green" : "bg-av-red/10 text-av-red"}`}
                    >
                      {Math.abs(total - 100) < 0.01 ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                      {total}% allocated
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {p.allocations.map((a) => (
                      <div key={a.id} className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-center">
                        <SearchableSelect
                          className="sm:col-span-8"
                          placeholder="Select fund — type to search"
                          value={a.fundId}
                          options={funds.map((f) => ({
                            value: String(f.id),
                            label: f.category ? `${f.category} — ${f.displayName}` : f.displayName,
                          }))}
                          onChange={(fundId) => {
                            const fund = funds.find((f) => String(f.id) === String(fundId));
                            onUpdateAllocation(p.id, a.id, { fundId, fundName: fund?.displayName || "" });
                          }}
                        />
                        <div className="relative sm:col-span-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={a.allocationPct}
                            onChange={(e) => onUpdateAllocation(p.id, a.id, { allocationPct: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-navy outline-none focus:border-gold"
                          />
                          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveAllocation(p.id, a.id)}
                          className="flex items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-av-red/10 hover:text-av-red sm:col-span-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => onAddAllocation(p.id)}
                    className="mt-2 flex items-center gap-1 text-xs font-semibold text-gold-dark hover:underline"
                  >
                    <Plus size={12} />
                    {p.allocations.length ? "Add Another Fund" : "Add Fund"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onAddProduct}
        className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-gold-dark transition hover:underline"
      >
        <Plus size={14} />
        Add Another Product
      </button>
    </StepCard>
  );
}
