import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { LICENSED_PROVINCE_CODES, QUEBEC_SECTORS, COMPANIES_REPRESENTED_OPTIONS } from "../lib/salesPackageOptions";

const OWNERSHIP_OPTIONS = [
  "No ownership relationship",
  "Advisor owns interest in insurer",
  "Insurer owns interest in advisor business",
  "Other / review required",
];

const COMPENSATION_OPTIONS = ["Commission-based / insurer-paid through agency", "Salary", "Fee-based", "Combination", "Other"];

// Only one agency for now — more will be added once branch addresses are on file.
const AGENCY_OPTIONS = ["World Financial Group (WFG)"];

// More branch addresses will be added as they're provided.
const BRANCH_OPTIONS = ["1075 W Georgia St, Vancouver, Floor 26 Unit 2650"];

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30";

/**
 * "Sales Package & Compliance Profile" — reusable advisor facts (licensing,
 * companies represented, supervisor, compensation disclosure) that Sales
 * Package Prep pulls from automatically (e.g. to auto-generate the Agent
 * Disclosure Form) instead of re-asking on every client package.
 * Client-specific facts never live here — see Sales Package Prep for those.
 */
export default function ComplianceProfilePanel() {
  const { user, updateComplianceProfile } = useAuth();
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);

  const [professionalTitle, setProfessionalTitle] = useState(user?.professionalTitle || "");
  const [businessEmail, setBusinessEmail] = useState(user?.businessEmail || "");
  const [businessPhone, setBusinessPhone] = useState(user?.businessPhone || "");
  const [agencyName, setAgencyName] = useState(user?.agencyName || "");
  const [agentCode, setAgentCode] = useState(user?.agentCode || "");
  const [businessBranchName, setBusinessBranchName] = useState(user?.businessBranchName || "");
  const [licensedProvinces, setLicensedProvinces] = useState(user?.licensedProvinces || []);
  const [licenceNumbers, setLicenceNumbers] = useState(user?.licenceNumbers || {});
  const [quebecSectors, setQuebecSectors] = useState(user?.quebecSectors || []);
  const [companiesRepresented, setCompaniesRepresented] = useState(user?.companiesRepresented || []);
  const [supervisorRequired, setSupervisorRequired] = useState(Boolean(user?.supervisorRequired));
  const [supervisorName, setSupervisorName] = useState(user?.supervisorName || "");
  const [supervisorTitle, setSupervisorTitle] = useState(user?.supervisorTitle || "");
  const [supervisorEmail, setSupervisorEmail] = useState(user?.supervisorEmail || "");
  const [supervisorPhone, setSupervisorPhone] = useState(user?.supervisorPhone || "");
  const [ownershipRelationship, setOwnershipRelationship] = useState(user?.ownershipRelationship || "");
  const [compensationModel, setCompensationModel] = useState(user?.compensationModel || "");
  const [additionalCompensationEligible, setAdditionalCompensationEligible] = useState(
    Boolean(user?.additionalCompensationEligible)
  );
  const [standingDisclosure, setStandingDisclosure] = useState(user?.standingDisclosure || "");

  const isQuebecLicensed = licensedProvinces.includes("QC");

  const toggle = (list, setList, value) =>
    setList((l) => (l.includes(value) ? l.filter((v) => v !== value) : [...l, value]));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateComplianceProfile({
        professionalTitle,
        businessEmail,
        businessPhone,
        agencyName,
        agentCode,
        businessBranchName,
        licensedProvinces,
        licenceNumbers,
        quebecSectors: isQuebecLicensed ? quebecSectors : [],
        companiesRepresented,
        supervisorRequired,
        supervisorName: supervisorRequired ? supervisorName : "",
        supervisorTitle: supervisorRequired ? supervisorTitle : "",
        supervisorEmail: supervisorRequired ? supervisorEmail : "",
        supervisorPhone: supervisorRequired ? supervisorPhone : "",
        ownershipRelationship,
        compensationModel,
        additionalCompensationEligible,
        standingDisclosure,
      });
      addToast("Compliance profile saved");
    } catch (err) {
      addToast(err.message || "Could not save compliance profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-navy">Advisor Identity</h2>
        <p className="mb-4 text-xs text-slate-400">Your display name is set under the Account tab.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Professional Title</span>
            <input value={professionalTitle} onChange={(e) => setProfessionalTitle(e.target.value)} placeholder="Financial Advisor" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Business Email</span>
            <input type="email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} placeholder="advisor@domain.ca" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Business Phone</span>
            <input value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} placeholder="(403) 555-0000" className={inputClass} />
          </label>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-navy">Agency / Dealer</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Agency / Dealer</span>
            <select value={agencyName} onChange={(e) => setAgencyName(e.target.value)} className={inputClass}>
              <option value="">Select...</option>
              {AGENCY_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Advisor / Agent Code</span>
            <input value={agentCode} onChange={(e) => setAgentCode(e.target.value)} placeholder="WFG123456" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Branch</span>
            <select value={businessBranchName} onChange={(e) => setBusinessBranchName(e.target.value)} className={inputClass}>
              <option value="">Select...</option>
              {[...BRANCH_OPTIONS, ...(businessBranchName && !BRANCH_OPTIONS.includes(businessBranchName) ? [businessBranchName] : [])].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-navy">Licensing</h2>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Licensed Provinces / Territories</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {LICENSED_PROVINCE_CODES.map(([code, name]) => (
            <label
              key={code}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                licensedProvinces.includes(code) ? "border-gold bg-gold/10 text-gold-dark" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <input type="checkbox" checked={licensedProvinces.includes(code)} onChange={() => toggle(licensedProvinces, setLicensedProvinces, code)} className="sr-only" />
              {code} — {name}
            </label>
          ))}
        </div>

        {isQuebecLicensed && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Quebec Sector(s)</p>
            <div className="flex flex-wrap gap-2">
              {QUEBEC_SECTORS.map((sector) => (
                <label
                  key={sector}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                    quebecSectors.includes(sector) ? "border-gold bg-gold/10 text-gold-dark" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <input type="checkbox" checked={quebecSectors.includes(sector)} onChange={() => toggle(quebecSectors, setQuebecSectors, sector)} className="sr-only" />
                  {sector}
                </label>
              ))}
            </div>
          </div>
        )}

        {licensedProvinces.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Licence Number by Province (optional)</p>
            <div className="flex flex-col gap-2">
              {licensedProvinces.map((code) => (
                <div key={code} className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-center">
                  <span className="text-sm font-medium text-navy sm:col-span-2">{code}</span>
                  <input
                    placeholder="Licence number"
                    value={licenceNumbers[code]?.number || ""}
                    onChange={(e) => setLicenceNumbers((m) => ({ ...m, [code]: { ...m[code], number: e.target.value } }))}
                    className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold sm:col-span-5"
                  />
                  <input
                    type="date"
                    value={licenceNumbers[code]?.expiry || ""}
                    onChange={(e) => setLicenceNumbers((m) => ({ ...m, [code]: { ...m[code], expiry: e.target.value } }))}
                    className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold sm:col-span-5"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-navy">Companies Represented</h2>
        <div className="flex flex-wrap gap-2">
          {COMPANIES_REPRESENTED_OPTIONS.map((c) => (
            <label
              key={c}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                companiesRepresented.includes(c) ? "border-gold bg-gold/10 text-gold-dark" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <input type="checkbox" checked={companiesRepresented.includes(c)} onChange={() => toggle(companiesRepresented, setCompaniesRepresented, c)} className="sr-only" />
              {c}
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-navy">Supervisor</h2>
        <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
          <span className="text-sm text-navy">Supervisor required?</span>
          <label className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center">
            <input type="checkbox" checked={supervisorRequired} onChange={(e) => setSupervisorRequired(e.target.checked)} className="peer sr-only" />
            <span className="absolute inset-0 rounded-full bg-slate-200 transition-colors peer-checked:bg-gold" />
            <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
          </label>
        </div>
        {supervisorRequired && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Supervisor Name</span>
              <input value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Supervisor Title</span>
              <input value={supervisorTitle} onChange={(e) => setSupervisorTitle(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Supervisor Email</span>
              <input type="email" value={supervisorEmail} onChange={(e) => setSupervisorEmail(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Supervisor Phone</span>
              <input value={supervisorPhone} onChange={(e) => setSupervisorPhone(e.target.value)} className={inputClass} />
            </label>
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-navy">Disclosure Defaults</h2>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Ownership Relationship</span>
            <select value={ownershipRelationship} onChange={(e) => setOwnershipRelationship(e.target.value)} className={inputClass}>
              <option value="">Select...</option>
              {OWNERSHIP_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Compensation Model</span>
            <select value={compensationModel} onChange={(e) => setCompensationModel(e.target.value)} className={inputClass}>
              <option value="">Select...</option>
              {COMPENSATION_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
            <span className="text-sm text-navy">Additional compensation eligible?</span>
            <label className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center">
              <input type="checkbox" checked={additionalCompensationEligible} onChange={(e) => setAdditionalCompensationEligible(e.target.checked)} className="peer sr-only" />
              <span className="absolute inset-0 rounded-full bg-slate-200 transition-colors peer-checked:bg-gold" />
              <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Known Standing Conflict / Additional Disclosure (optional)</span>
            <textarea rows={3} value={standingDisclosure} onChange={(e) => setStandingDisclosure(e.target.value)} className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30" />
          </label>
        </div>
      </section>

      <div>
        <button type="submit" disabled={saving} className="rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light disabled:opacity-60">
          {saving ? "Saving..." : "Save Compliance Profile"}
        </button>
      </div>
    </form>
  );
}
