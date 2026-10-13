import { Plus, Trash2 } from "lucide-react";
import SearchableSelect from "../SearchableSelect";
import { useClients } from "../../context/ClientsContext";
import { birthDateError, MIN_BIRTH_DATE, todayISO } from "../../lib/dates";
import { CANADIAN_STATUSES, PROVINCES, MARITAL_STATUSES, DEPENDANT_RELATIONSHIPS } from "../../lib/salesPackageOptions";
import { emptyDependant } from "../../lib/salesPackage/wizard";
import { StepCard, FormField, CurrencyField, inputClass } from "./shared";
import Switch from "../Switch";

export default function ClientStep({ data, patch }) {
  const { clients } = useClients();
  const clientOptions = clients
    .map((c) => {
      const name = `${c.first || ""} ${c.last || ""}`.trim();
      return { value: String(c.id), label: name, search: `${name} ${c.email || ""} ${c.phone || ""}` };
    })
    .filter((o) => o.label);
  const updateDependant = (id, fields) => patch({ dependants: data.dependants.map((d) => (d.id === id ? { ...d, ...fields } : d)) });
  const addDependant = () => patch({ dependants: [...data.dependants, emptyDependant()] });
  const removeDependant = (id) => patch({ dependants: data.dependants.filter((d) => d.id !== id) });

  return (
    <>
      <StepCard title="Client Information" subtitle="Enter the basic details for this sales package.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Policy Owner" required>
            <SearchableSelect
              freeText
              placeholder="Type a name or pick one of your clients"
              value={data.policyOwner}
              options={clientOptions}
              onChange={(name, option) => {
                const picked = option ? clients.find((c) => String(c.id) === option.value) : null;
                if (!picked) return patch({ policyOwner: name });
                // Pull in what's already on file for this client — but never
                // overwrite something the advisor has already typed.
                const fill = (current, incoming) => (current ? current : incoming || "");
                patch({
                  policyOwner: name,
                  insuredPerson: fill(data.insuredPerson, name),
                  dateOfBirth: fill(data.dateOfBirth, picked.dateOfBirth),
                  province: fill(data.province, picked.province),
                  occupation: fill(data.occupation, picked.job),
                });
              }}
            />
          </FormField>
          <FormField label="Insured Person" required>
            <input className={inputClass} value={data.insuredPerson} onChange={(e) => patch({ insuredPerson: e.target.value })} />
          </FormField>
          <FormField label="Canadian Status" required>
            <select className={inputClass} value={data.canadianStatus} onChange={(e) => patch({ canadianStatus: e.target.value })}>
              <option value="">Select...</option>
              {CANADIAN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Province" required>
            <select className={inputClass} value={data.province} onChange={(e) => patch({ province: e.target.value })}>
              <option value="">Select...</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Date of Birth" required>
            <input
              type="date"
              min={MIN_BIRTH_DATE}
              max={todayISO()}
              className={`${inputClass} ${birthDateError(data.dateOfBirth) ? "border-av-red focus:border-av-red focus:ring-av-red/20" : ""}`}
              value={data.dateOfBirth}
              onChange={(e) => patch({ dateOfBirth: e.target.value })}
            />
            {birthDateError(data.dateOfBirth) && <span className="text-xs text-av-red">{birthDateError(data.dateOfBirth)}</span>}
          </FormField>
          <FormField label="Marital Status">
            <select className={inputClass} value={data.maritalStatus} onChange={(e) => patch({ maritalStatus: e.target.value })}>
              <option value="">Select...</option>
              {MARITAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Occupation">
            <input className={inputClass} value={data.occupation} onChange={(e) => patch({ occupation: e.target.value })} />
          </FormField>
          <CurrencyField
            label="Annual Income"
            value={data.annualIncome}
            onChange={(v) => patch({ annualIncome: v })}
            placeholder="$120,000"
          />
        </div>
      </StepCard>

      <StepCard title="Financial Situation" subtitle="Mortgage and other debt obligations.">
        <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
          <span className="text-sm text-navy">Homeowner?</span>
          <Switch label="Homeowner?" checked={data.homeowner} onChange={(e) => patch({ homeowner: e.target.checked })} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data.homeowner && (
            <CurrencyField
              label="Mortgage Balance"
              value={data.mortgageBalance}
              onChange={(v) => patch({ mortgageBalance: v })}
              placeholder="$400,000"
            />
          )}
          <CurrencyField label="Other Major Debt" value={data.otherMajorDebt} onChange={(v) => patch({ otherMajorDebt: v })} />
        </div>
      </StepCard>

      <StepCard title="Family" subtitle="Dependants for this client.">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Dependants</span>
          <button
            type="button"
            onClick={addDependant}
            className="flex items-center gap-1 text-xs font-semibold text-gold-dark hover:underline"
          >
            <Plus size={12} />
            {data.dependants.length ? "Add Another Dependant" : "Add Dependant"}
          </button>
        </div>
        <div className="mt-2 flex flex-col gap-3">
          {data.dependants.map((dep) => (
            <div key={dep.id} className="rounded-xl border border-slate-200 p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Full Name</span>
                  <input
                    placeholder="Full name"
                    value={dep.fullName}
                    onChange={(e) => updateDependant(dep.id, { fullName: e.target.value })}
                    className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Relationship</span>
                  <select
                    value={dep.relationship}
                    onChange={(e) => updateDependant(dep.id, { relationship: e.target.value })}
                    className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold"
                  >
                    <option value="">Select...</option>
                    {DEPENDANT_RELATIONSHIPS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
                {dep.relationship === "Other" && (
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Specify Relationship</span>
                    <input
                      placeholder="e.g. Grandchild"
                      value={dep.relationshipOther}
                      onChange={(e) => updateDependant(dep.id, { relationshipOther: e.target.value })}
                      className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold"
                    />
                  </label>
                )}
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Date of Birth</span>
                  <input
                    type="date"
                    min={MIN_BIRTH_DATE}
                    max={todayISO()}
                    value={dep.dateOfBirth}
                    onChange={(e) => updateDependant(dep.id, { dateOfBirth: e.target.value })}
                    className={`rounded-lg border px-2.5 py-2 text-sm text-navy outline-none focus:border-gold ${birthDateError(dep.dateOfBirth) ? "border-av-red" : "border-slate-200"}`}
                  />
                  {birthDateError(dep.dateOfBirth) && <span className="text-xs text-av-red">{birthDateError(dep.dateOfBirth)}</span>}
                </label>
              </div>
              <button
                type="button"
                onClick={() => removeDependant(dep.id)}
                className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-av-red"
              >
                <Trash2 size={13} />
                Remove dependant
              </button>
            </div>
          ))}
        </div>
      </StepCard>
    </>
  );
}
