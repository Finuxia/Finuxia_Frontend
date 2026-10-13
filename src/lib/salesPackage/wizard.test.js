import { describe, expect, it } from "vitest";
import {
  advanceBlocker,
  computeStepStates,
  emptyData,
  emptyProduct,
  productsNeedingAllocation,
  requiredSupervisionQuestions,
} from "./wizard";

const TERM = {
  ...emptyProduct(),
  companyId: "1",
  productId: "10",
  type: "term",
  coverageAmount: "$1",
  frequency: "Monthly",
  premium: "$1",
};
const fund = (pct, over = {}) => ({
  ...TERM,
  type: "segregated_fund",
  accountType: "RRSP",
  allocations: [{ id: "a", fundId: "5", fundName: "Equity", allocationPct: pct }],
  ...over,
});
const answered = (over = {}) => ({
  applicationReviewed: true,
  needsAnalysisReviewed: true,
  policyIllustrationsReviewed: true,
  lifeInsuranceReplacement: false,
  lirdReviewed: null,
  segFundsLeveraging: false,
  disclosureDocReviewed: null,
  ...over,
});
const dataWith = (over = {}) => ({
  ...emptyData(),
  policyOwner: "A",
  insuredPerson: "A",
  canadianStatus: "Citizen",
  province: "Ontario",
  dateOfBirth: "1980-05-05",
  needs: ["Life Insurance"],
  products: [TERM],
  reasonWhyLetterText: "Dear A",
  supervisionConfirmations: answered(),
  ...over,
});
const states = (data, extra = {}) => computeStepStates({ data, documents: [{ uploaded: true }], status: "draft", ...extra });
const STEP = { client: 0, needs: 1, products: 2, details: 3, letter: 4, compliance: 5, documents: 6, review: 7 };

describe("which compliance questions must be answered", () => {
  it("five always, and the follow-up of each Yes", () => {
    const base = [
      "applicationReviewed",
      "needsAnalysisReviewed",
      "policyIllustrationsReviewed",
      "lifeInsuranceReplacement",
      "segFundsLeveraging",
    ];
    expect(requiredSupervisionQuestions(answered())).toEqual(base);
    expect(requiredSupervisionQuestions(answered({ lifeInsuranceReplacement: true }))).toEqual([...base, "lirdReviewed"]);
    expect(requiredSupervisionQuestions(answered({ segFundsLeveraging: true }))).toEqual([...base, "disclosureDocReviewed"]);
    expect(requiredSupervisionQuestions(answered({ lifeInsuranceReplacement: true, segFundsLeveraging: true }))).toEqual([
      ...base,
      "lirdReviewed",
      "disclosureDocReviewed",
    ]);
  });

  it("a No (or no answer yet) asks for no follow-up", () => {
    expect(requiredSupervisionQuestions(answered({ lifeInsuranceReplacement: false }))).not.toContain("lirdReviewed");
    expect(requiredSupervisionQuestions(answered({ lifeInsuranceReplacement: null }))).not.toContain("lirdReviewed");
    expect(requiredSupervisionQuestions(answered({ segFundsLeveraging: null }))).not.toContain("disclosureDocReviewed");
  });
});

describe("what blocks moving forward", () => {
  it("nothing blocks a complete, valid draft on any step", () => {
    for (let step = 0; step < 8; step += 1) expect(advanceBlocker(step, dataWith()), step).toBeNull();
  });

  it("a bad date of birth, the client's or any dependant's, blocks the Client step only", () => {
    expect(advanceBlocker(0, dataWith({ dateOfBirth: "2999-01-01" }))).toMatch(/^Fix the date of birth first/);
    const dependants = [{ id: "d", fullName: "K", relationship: "Child", relationshipOther: "", dateOfBirth: "2999-01-01" }];
    expect(advanceBlocker(0, dataWith({ dependants }))).toMatch(/^Fix the date of birth first/);
    expect(advanceBlocker(1, dataWith({ dateOfBirth: "2999-01-01", dependants }))).toBeNull();
  });

  it("a segregated fund with no account type blocks Products, naming the product", () => {
    const data = dataWith({ products: [fund("100", { accountType: "", productName: "GrowthSeg" })] });
    expect(advanceBlocker(2, data)).toBe("Choose an Account Type for GrowthSeg before continuing.");
    expect(advanceBlocker(2, dataWith({ products: [fund("100", { accountType: "" })] }))).toContain("the Segregated Fund");
  });

  it("allocations must total 100% to within a hundredth of a percent, and an investment product needs some", () => {
    expect(advanceBlocker(2, dataWith({ products: [fund("100")] }))).toBeNull();
    expect(advanceBlocker(2, dataWith({ products: [fund("100.005")] }))).toBeNull();
    expect(advanceBlocker(2, dataWith({ products: [fund("99.5")] }))).toMatch(/^Fund allocations must total 100%/);
    expect(advanceBlocker(2, dataWith({ products: [fund("100.5")] }))).toMatch(/^Fund allocations must total 100%/);
    expect(advanceBlocker(2, dataWith({ products: [fund("100", { allocations: [] })] }))).toMatch(/^Fund allocations must total 100%/);
    expect(productsNeedingAllocation(dataWith({ products: [TERM] }))).toEqual([]); // a term product has no funds
  });

  it("the Reason Why Letter must have text, and spaces are not text", () => {
    expect(advanceBlocker(4, dataWith({ reasonWhyLetterText: "" }))).toMatch(/Reason Why Letter/);
    expect(advanceBlocker(4, dataWith({ reasonWhyLetterText: "   \n " }))).toMatch(/Reason Why Letter/);
    expect(advanceBlocker(3, dataWith({ reasonWhyLetterText: "" }))).toBeNull(); // only the letter step cares
  });

  it("every compliance question that applies must be answered, the follow-ups of a Yes included", () => {
    const blocked = "Answer all compliance confirmation questions before continuing.";
    expect(advanceBlocker(5, dataWith({ supervisionConfirmations: answered({ applicationReviewed: null }) }))).toBe(blocked);
    expect(advanceBlocker(5, dataWith({ supervisionConfirmations: answered({ segFundsLeveraging: null }) }))).toBe(blocked);
    expect(advanceBlocker(5, dataWith({ supervisionConfirmations: answered({ lifeInsuranceReplacement: true }) }))).toBe(blocked);
    expect(advanceBlocker(5, dataWith({ supervisionConfirmations: answered({ segFundsLeveraging: true }) }))).toBe(blocked);
    expect(
      advanceBlocker(5, dataWith({ supervisionConfirmations: answered({ segFundsLeveraging: true, disclosureDocReviewed: false }) }))
    ).toBeNull();
    expect(
      advanceBlocker(5, dataWith({ supervisionConfirmations: answered({ lifeInsuranceReplacement: true, lirdReviewed: true }) }))
    ).toBeNull();
  });
});

describe("what the stepper shows as complete", () => {
  it("a complete draft is complete on every step that has something to complete", () => {
    const all = states(dataWith(), { status: "completed" }).map((s) => s.complete);
    expect(all).toEqual([true, true, true, true, true, true, true, true]);
  });

  it("Client: all five required fields, and every date of birth valid", () => {
    for (const field of ["policyOwner", "insuredPerson", "canadianStatus", "province", "dateOfBirth"]) {
      expect(states(dataWith({ [field]: "" }))[STEP.client].complete, field).toBe(false);
    }
    expect(states(dataWith({ policyOwner: "  " }))[STEP.client].complete).toBe(false);
    expect(states(dataWith({ dateOfBirth: "2999-01-01" }))[STEP.client].complete).toBe(false);
    const dependants = [{ id: "d", fullName: "K", relationship: "Child", relationshipOther: "", dateOfBirth: "2999-01-01" }];
    expect(states(dataWith({ dependants }))[STEP.client].complete).toBe(false);
  });

  it("Needs: at least one", () => {
    expect(states(dataWith({ needs: [] }))[STEP.needs].complete).toBe(false);
    expect(states(dataWith({ needs: [] }))[STEP.needs].started).toBe(false);
    expect(states(dataWith({ needs: [], otherNeed: "x" }))[STEP.needs].started).toBe(true);
  });

  it("Products: every row filled in, a segregated fund with an account type, and allocations at 100%", () => {
    expect(states(dataWith({ products: [] }))[STEP.products].complete).toBe(false);
    expect(states(dataWith({ products: [{ ...TERM, premium: "" }] }))[STEP.products].complete).toBe(false);
    expect(states(dataWith({ products: [fund("100", { accountType: "" })] }))[STEP.products].complete).toBe(false);
    expect(states(dataWith({ products: [fund("99.5")] }))[STEP.products].complete).toBe(false);
    expect(states(dataWith({ products: [fund("100")] }))[STEP.products].complete).toBe(true);
    expect(states(dataWith({ products: [fund("100.005")] }))[STEP.products].complete).toBe(true);
  });

  it("Details: the investment profile, but only when there is an investment product", () => {
    expect(states(dataWith())[STEP.details].complete).toBe(true);
    const investing = dataWith({ products: [fund("100")] });
    expect(states(investing)[STEP.details].complete).toBe(false);
    const profile = { riskTolerance: "Low", investmentHorizon: "10y", investmentObjective: "Growth", sourceOfFunds: "Savings" };
    expect(states({ ...investing, investmentProfile: profile })[STEP.details].complete).toBe(true);
    expect(states({ ...investing, investmentProfile: { ...profile, sourceOfFunds: "" } })[STEP.details].complete).toBe(false);
    expect(states(dataWith())[STEP.details].needsVisit).toBe(true);
    expect(states(investing)[STEP.details].needsVisit).toBe(false);
  });

  it("Letter, Compliance, Documents and Review", () => {
    expect(states(dataWith({ reasonWhyLetterText: " " }))[STEP.letter].complete).toBe(false);
    expect(states(dataWith({ supervisionConfirmations: answered({ segFundsLeveraging: true }) }))[STEP.compliance].complete).toBe(false);
    expect(states(dataWith({ supervisionConfirmations: answered({ applicationReviewed: null }) }))[STEP.compliance].complete).toBe(false);
    expect(states(dataWith(), { documents: [{ uploaded: true }, { uploaded: false }] })[STEP.documents].complete).toBe(false);
    expect(states(dataWith(), { documents: [{ uploaded: true }, { uploaded: false }] })[STEP.documents].started).toBe(true);
    expect(states(dataWith(), { status: "draft" })[STEP.review].complete).toBe(false);
    expect(states(dataWith(), { status: "completed" })[STEP.review].complete).toBe(true);
  });
});
