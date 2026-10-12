import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { StepCard, YesNo } from "./shared";

function ProfileLine({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-sm text-navy">{children || <span className="text-amber-600">Not set</span>}</span>
    </div>
  );
}

function ComplianceProfileCard({ profile }) {
  const provinces = profile?.licensedProvinces || [];
  const companies = profile?.companiesRepresented || [];
  const incomplete =
    provinces.length === 0 || companies.length === 0 || !profile?.agencyName || (profile?.supervisorRequired && !profile?.supervisorName);
  return (
    <StepCard title="Your Compliance Profile" subtitle="This is what the Agent Disclosure and Supervision forms are filled from.">
      {incomplete && (
        <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle size={13} />
          Some details are missing — complete them so the forms come out right.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ProfileLine label="Agency / Dealer">{profile?.agencyName}</ProfileLine>
        <ProfileLine label="Branch">{profile?.businessBranchName}</ProfileLine>
        <ProfileLine label="Agent Code">{profile?.agentCode}</ProfileLine>
        <ProfileLine label="Licensed In">{provinces.join(", ")}</ProfileLine>
        <ProfileLine label="Companies Represented">{companies.join(", ")}</ProfileLine>
        <ProfileLine label="Supervisor">
          {profile?.supervisorRequired ? [profile.supervisorName, profile.supervisorTitle].filter(Boolean).join(" — ") : "Not required"}
        </ProfileLine>
      </div>
      <Link to="/profile?tab=compliance" className="mt-3 inline-block text-xs font-semibold text-gold-dark hover:underline">
        Edit in Profile → Compliance
      </Link>
    </StepCard>
  );
}

export default function ComplianceStep({ data, patch, profile }) {
  const c = data.supervisionConfirmations;
  const setC = (fields) => patch({ supervisionConfirmations: { ...c, ...fields } });
  return (
    <>
      <ComplianceProfileCard profile={profile} />
      <StepCard
        title="Compliance Confirmations"
        subtitle="Only you can answer these — they're never inferred, and they're used to generate the Supervision Form on the next step."
      >
        <div className="flex flex-col gap-2.5">
          <YesNo label="Insurance Application reviewed?" value={c.applicationReviewed} onChange={(v) => setC({ applicationReviewed: v })} />
          <YesNo label="Needs Analysis reviewed?" value={c.needsAnalysisReviewed} onChange={(v) => setC({ needsAnalysisReviewed: v })} />
          <YesNo
            label="Policy Illustrations reviewed?"
            value={c.policyIllustrationsReviewed}
            onChange={(v) => setC({ policyIllustrationsReviewed: v })}
          />
          <YesNo
            label="Is this a Life Insurance Replacement?"
            value={c.lifeInsuranceReplacement}
            onChange={(v) => setC({ lifeInsuranceReplacement: v, lirdReviewed: v ? c.lirdReviewed : null })}
          />
          {c.lifeInsuranceReplacement === true && (
            <YesNo
              label="LIRD / Written Comparative Analysis reviewed?"
              value={c.lirdReviewed}
              onChange={(v) => setC({ lirdReviewed: v })}
            />
          )}
          <YesNo
            label="Segregated Funds Leveraging?"
            value={c.segFundsLeveraging}
            onChange={(v) => setC({ segFundsLeveraging: v, disclosureDocReviewed: v ? c.disclosureDocReviewed : null })}
          />
          {c.segFundsLeveraging === true && (
            <YesNo
              label="Disclosure Document reviewed?"
              value={c.disclosureDocReviewed}
              onChange={(v) => setC({ disclosureDocReviewed: v })}
            />
          )}
        </div>
      </StepCard>
    </>
  );
}
