/**
 * The sales package wizard's rules, with no React in them: the steps, what each step needs, the empty shapes of a draft,
 * and what stops the advisor moving on from a step. Everything here is a pure function of the draft data, so it can be
 * tested on its own.
 */
import { birthDateError } from "../dates";
import { INVESTMENT_BEARING_TYPES } from "../salesPackageOptions";

export const STEPS = ["Client", "Needs", "Products", "Details", "Reason Why Letter", "Compliance", "Documents", "Review"];

export const emptySupervisionConfirmations = () => ({
  applicationReviewed: null,
  needsAnalysisReviewed: null,
  policyIllustrationsReviewed: null,
  lifeInsuranceReplacement: null,
  lirdReviewed: null,
  segFundsLeveraging: null,
  disclosureDocReviewed: null,
});

// lirdReviewed/disclosureDocReviewed only need an answer when their parent
// question was answered Yes.
export const requiredSupervisionQuestions = (confirmations) => {
  const required = [
    "applicationReviewed",
    "needsAnalysisReviewed",
    "policyIllustrationsReviewed",
    "lifeInsuranceReplacement",
    "segFundsLeveraging",
  ];
  if (confirmations.lifeInsuranceReplacement === true) required.push("lirdReviewed");
  if (confirmations.segFundsLeveraging === true) required.push("disclosureDocReviewed");
  return required;
};

const filled = (v) => (typeof v === "string" ? v.trim() !== "" : Boolean(v));

// Per-step completion for the stepper: `complete` = everything required on
// that step is done; `started` = something's been entered but it isn't
// finished (shown orange). `needsVisit` marks steps with nothing required
// that only count as done once the advisor has actually looked at them.
export function computeStepStates({ data, documents, status }) {
  const investmentProducts = data.products.filter((p) => INVESTMENT_BEARING_TYPES.has(p.type));
  const allocationsOk = investmentProducts.every(
    (p) => p.allocations.length > 0 && Math.abs(p.allocations.reduce((sum, a) => sum + (parseFloat(a.allocationPct) || 0), 0) - 100) < 0.01
  );
  const productStarted = data.products.some((p) => p.companyId || p.productId || p.coverageAmount || p.premium || p.frequency);
  const productsComplete =
    data.products.length > 0 &&
    data.products.every(
      (p) => p.companyId && p.productId && p.coverageAmount && p.frequency && p.premium && (p.type !== "segregated_fund" || p.accountType)
    ) &&
    allocationsOk;
  const profile = data.investmentProfile || {};
  const profileFields = [profile.riskTolerance, profile.investmentHorizon, profile.investmentObjective, profile.sourceOfFunds];
  const clientRequired = [data.policyOwner, data.insuredPerson, data.canadianStatus, data.province, data.dateOfBirth];
  const confirmations = data.supervisionConfirmations || {};
  const requiredQs = requiredSupervisionQuestions(confirmations);

  return [
    {
      complete:
        clientRequired.every(filled) && !birthDateError(data.dateOfBirth) && data.dependants.every((d) => !birthDateError(d.dateOfBirth)),
      started:
        clientRequired.some(filled) ||
        filled(data.maritalStatus) ||
        filled(data.occupation) ||
        filled(data.annualIncome) ||
        data.dependants.length > 0,
    },
    { complete: data.needs.length > 0, started: data.needs.length > 0 || filled(data.otherNeed) },
    { complete: productsComplete, started: productStarted },
    {
      complete: investmentProducts.length > 0 ? profileFields.every(filled) : true,
      started: profileFields.some(filled) || data.existingCoverage.length > 0 || filled(data.advisorNotes),
      needsVisit: investmentProducts.length === 0,
    },
    { complete: filled(data.reasonWhyLetterText), started: filled(data.reasonWhyLetterText) },
    {
      complete: requiredQs.every((k) => confirmations[k] !== null && confirmations[k] !== undefined),
      started: Object.values(confirmations).some((v) => v !== null && v !== undefined),
    },
    { complete: documents.every((d) => d.uploaded), started: documents.some((d) => d.uploaded) },
    { complete: status === "completed", started: false, needsVisit: true },
  ];
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const emptyDependant = () => ({ id: uid(), fullName: "", relationship: "", relationshipOther: "", dateOfBirth: "" });
export const emptyProduct = () => ({
  id: uid(),
  companyId: "",
  company: "",
  productId: "",
  productName: "",
  type: "",
  accountType: "",
  coverageAmount: "",
  premium: "",
  frequency: "",
  purpose: "",
  allocations: [],
});
export const emptyAllocation = () => ({ id: uid(), fundId: "", fundName: "", allocationPct: "" });
export const emptyCoverage = () => ({ id: uid(), provider: "", type: "", amount: "" });

export const emptyData = () => ({
  policyOwner: "",
  insuredPerson: "",
  canadianStatus: "",
  province: "",
  dateOfBirth: "",
  maritalStatus: "",
  occupation: "",
  annualIncome: "",
  dependants: [],
  homeowner: false,
  mortgageBalance: "",
  otherMajorDebt: "",
  needs: [],
  otherNeed: "",
  products: [emptyProduct()],
  investmentProfile: { riskTolerance: "", investmentHorizon: "", investmentObjective: "", sourceOfFunds: "" },
  existingCoverage: [],
  advisorNotes: "",
  reasonWhyLetterText: "",
  supervisionConfirmations: emptySupervisionConfirmations(),
});

/** The products whose fund allocations do not (yet) add up to 100%. */
export function productsNeedingAllocation(data) {
  return data.products
    .filter((p) => INVESTMENT_BEARING_TYPES.has(p.type))
    .filter((p) => {
      const total = p.allocations.reduce((sum, a) => sum + (parseFloat(a.allocationPct) || 0), 0);
      return p.allocations.length === 0 || Math.abs(total - 100) > 0.01;
    });
}

/**
 * Why the advisor may not move FORWARD from `step`, as a sentence to show them, or null if they may. (Going back is
 * always allowed.)
 */
export function advanceBlocker(step, data) {
  if (step === 0) {
    const badDob = birthDateError(data.dateOfBirth) || data.dependants.map((d) => birthDateError(d.dateOfBirth)).find(Boolean);
    if (badDob) return `Fix the date of birth first: ${badDob}`;
  }
  if (step === 2) {
    const noAccount = data.products.find((p) => p.type === "segregated_fund" && !p.accountType);
    if (noAccount) return `Choose an Account Type for ${noAccount.productName || "the Segregated Fund"} before continuing.`;
    const incomplete = productsNeedingAllocation(data);
    if (incomplete.length > 0) {
      return `Fund allocations must total 100% before continuing (${incomplete[0].productName || "a product"} isn't there yet).`;
    }
  }
  if (step === 4 && !data.reasonWhyLetterText.trim()) return "Generate and save the Reason Why Letter before continuing.";
  if (step === 5) {
    const unanswered = requiredSupervisionQuestions(data.supervisionConfirmations).filter(
      (key) => data.supervisionConfirmations[key] === null || data.supervisionConfirmations[key] === undefined
    );
    if (unanswered.length > 0) return "Answer all compliance confirmation questions before continuing.";
  }
  return null;
}
