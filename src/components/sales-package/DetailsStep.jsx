import { Plus, Trash2 } from "lucide-react";
import {
  RISK_TOLERANCES,
  INVESTMENT_HORIZONS,
  INVESTMENT_OBJECTIVES,
  SOURCES_OF_FUNDS,
  EXISTING_COVERAGE_TYPES,
} from "../../lib/salesPackageOptions";
import { emptyCoverage } from "../../lib/salesPackage/wizard";
import { StepCard, FormField, CurrencyInput, inputClass } from "./shared";

export default function DetailsStep({ data, patch, hasInvestmentProduct }) {
  const updateCoverage = (id, fields) =>
    patch({
      existingCoverage: data.existingCoverage.map((c) =>
        c.id === id ? { ...c, ...fields } : c,
      ),
    });
  const addCoverage = () =>
    patch({ existingCoverage: [...data.existingCoverage, emptyCoverage()] });
  const removeCoverage = (id) =>
    patch({
      existingCoverage: data.existingCoverage.filter((c) => c.id !== id),
    });
  const patchInvestmentProfile = (fields) =>
    patch({ investmentProfile: { ...data.investmentProfile, ...fields } });

  return (
    <>
      {hasInvestmentProduct && (
        <StepCard
          title="Investment Profile"
          subtitle="Complete investment profile for UL/Seg fund products."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <FormField label="Risk Tolerance">
              <select
                className={inputClass}
                value={data.investmentProfile.riskTolerance}
                onChange={(e) =>
                  patchInvestmentProfile({ riskTolerance: e.target.value })
                }
              >
                <option value="">Select...</option>
                {RISK_TOLERANCES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Investment Horizon">
              <select
                className={inputClass}
                value={data.investmentProfile.investmentHorizon}
                onChange={(e) =>
                  patchInvestmentProfile({ investmentHorizon: e.target.value })
                }
              >
                <option value="">Select...</option>
                {INVESTMENT_HORIZONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Investment Objective">
              <select
                className={inputClass}
                value={data.investmentProfile.investmentObjective}
                onChange={(e) =>
                  patchInvestmentProfile({
                    investmentObjective: e.target.value,
                  })
                }
              >
                <option value="">Select...</option>
                {INVESTMENT_OBJECTIVES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Source of Funds">
              <select
                className={inputClass}
                value={data.investmentProfile.sourceOfFunds}
                onChange={(e) =>
                  patchInvestmentProfile({ sourceOfFunds: e.target.value })
                }
              >
                <option value="">Select...</option>
                {SOURCES_OF_FUNDS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </StepCard>
      )}

      <StepCard
        title="Existing Insurance & Investments"
        subtitle="Add any existing coverage the client has."
      >
        <div className="flex flex-col gap-2">
          {data.existingCoverage.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-center"
            >
              <input
                placeholder="Provider"
                value={c.provider}
                onChange={(e) =>
                  updateCoverage(c.id, { provider: e.target.value })
                }
                className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold sm:col-span-4"
              />
              <select
                value={c.type}
                onChange={(e) => updateCoverage(c.id, { type: e.target.value })}
                className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold sm:col-span-4"
              >
                <option value="">Type</option>
                {EXISTING_COVERAGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <CurrencyInput
                placeholder="$0"
                value={c.amount}
                onChange={(v) => updateCoverage(c.id, { amount: v })}
                className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold sm:col-span-3"
              />
              <button
                type="button"
                onClick={() => removeCoverage(c.id)}
                className="flex items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-av-red/10 hover:text-av-red sm:col-span-1"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addCoverage}
          className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-gold-dark transition hover:underline"
        >
          <Plus size={14} />
          Add Existing Coverage
        </button>
      </StepCard>

      <StepCard
        title="Advisor Notes / Special Circumstances"
        subtitle="Optional — Anything relevant that doesn't fit the fields above such as Disability Waiver of Charges."
      >
        <textarea
          rows={4}
          value={data.advisorNotes}
          onChange={(e) => patch({ advisorNotes: e.target.value })}
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
        />
      </StepCard>
    </>
  );
}
