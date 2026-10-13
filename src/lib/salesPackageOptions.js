// Static reference lists for Sales Package Prep — mirrors
// fna_backend/src/sales_packages/domain/entities.py exactly. Company/
// Product/Fund options are NOT here — those are real master data fetched
// from the backend (api.getSalesPackageCompanies/Products/Funds).

export const CANADIAN_STATUSES = ["Canadian Citizen", "Permanent Resident", "Work Permit", "Study Permit", "Other"];

export const PROVINCES = [
  "Alberta",
  "British Columbia",
  "Manitoba",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Nova Scotia",
  "Northwest Territories",
  "Nunavut",
  "Ontario",
  "Prince Edward Island",
  "Quebec",
  "Saskatchewan",
  "Yukon",
];

export const MARITAL_STATUSES = ["Single", "Married", "Common-law", "Divorced", "Widowed"];

export const DEPENDANT_RELATIONSHIPS = ["Spouse", "Son", "Daughter", "Mother", "Father", "Brother", "Sister", "Other"];

// Registered/non-registered account a Segregated Fund is held in — required
// for every Segregated Fund product.
export const ACCOUNT_TYPES = ["TFSA", "FHSA", "RSP", "Spousal RSP", "RIF", "Spousal RIF", "LIRA", "LIF", "Non-Registered"];

export const FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "annual", label: "Annual" },
  { value: "lump_sum", label: "Lump Sum" },
];

export const NEEDS = [
  "Family / Dependant Protection",
  "Mortgage Protection",
  "Income Replacement",
  "Final Expenses",
  "Education Funding",
  "Permanent Insurance",
  "Long-Term Value Accumulation",
  "Estate / Legacy Planning",
  "Critical Illness Protection",
  "Disability / Income Protection",
  "Business Protection",
  "Key Person / Buy-Sell",
];

export const RISK_TOLERANCES = ["Low", "Low-Medium", "Medium", "Medium-High", "High"];
export const INVESTMENT_HORIZONS = ["Under 5", "5-10", "10-20", "20+ years"];
export const INVESTMENT_OBJECTIVES = ["Income", "Balanced", "Growth"];
export const SOURCES_OF_FUNDS = [
  "Employment income",
  "Savings",
  "Existing registered account",
  "Inheritance",
  "Sale of property",
  "Business income",
  "Other",
];
export const TRANSACTION_TYPES = ["New contribution", "Transfer", "Switch"];

export const EXISTING_COVERAGE_TYPES = [
  { value: "life", label: "Life Insurance" },
  { value: "criticalIllness", label: "Critical Illness" },
  { value: "disabilityIncome", label: "Disability Income" },
  { value: "investments", label: "Investments" },
];

// Product types that need a fund/investment-allocation panel — must match
// backend's INVESTMENT_BEARING_TYPES exactly.
export const INVESTMENT_BEARING_TYPES = new Set(["universal_life", "segregated_fund"]);

// The documents required to complete a package — must match backend's
// UPLOADED_DOCUMENTS exactly (key order = upload UI order).
export const UPLOADED_DOCUMENTS = [
  { key: "agentDisclosureForm", label: "Agent Disclosure Form" },
  { key: "reasonWhyLetter", label: "Reason Why Letter" },
  { key: "fna", label: "FNA" },
  { key: "financialStrategy", label: "Financial Strategy" },
  { key: "illustration1", label: "Illustration 1" },
  { key: "illustration2", label: "Illustration 2" },
  { key: "supervisionForm", label: "Supervision Form" },
];

// Advisor Profile — Sales Package & Compliance Profile reference lists.
export const LICENSED_PROVINCE_CODES = [
  ["AB", "Alberta"],
  ["BC", "British Columbia"],
  ["MB", "Manitoba"],
  ["NB", "New Brunswick"],
  ["NL", "Newfoundland and Labrador"],
  ["NS", "Nova Scotia"],
  ["NT", "Northwest Territories"],
  ["NU", "Nunavut"],
  ["ON", "Ontario"],
  ["PE", "Prince Edward Island"],
  ["SK", "Saskatchewan"],
  ["YT", "Yukon"],
  ["QC", "Quebec"],
];

export const QUEBEC_SECTORS = ["Insurance of persons", "Accident and sickness sector"];

export const COMPANIES_REPRESENTED_OPTIONS = [
  "Allianz Global",
  "B2B Bank",
  "BMO Insurance",
  "Canada Protection Plan",
  "Empire Life",
  "Equitable Life",
  "Everest",
  "Foresters",
  "IA Excellence",
  "Industrial Alliance",
  "Ivari",
  "La Capitale",
  "Manulife",
  "People Corporation",
  "RBC",
  "RIMI",
  "SSQ (segregated funds)",
  "Travelance Inc",
];
