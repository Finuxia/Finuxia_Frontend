/**
 * Characterisation tests for the sales package wizard, written against the 2,000-line component BEFORE it was split, and
 * kept unchanged through the split: they pin what the wizard does (boot, picker, step validation, saving with the
 * optimistic-locking version, the version-conflict reload, the Reason Why Letter, compliance answers, uploads, the final
 * generate flow) so the refactor can be shown not to have changed it. The wizard produces compliance documents.
 */
import { http, HttpResponse } from "msw";
import { useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent, waitFor, within } from "../test/utils";
import SalesPackagePrep from "./SalesPackagePrep";

const P = `${API}/api/sales-packages`;
const DOCS = [
  ["agentDisclosureForm", "Agent Disclosure Form"],
  ["reasonWhyLetter", "Reason Why Letter"],
  ["fna", "FNA"],
  ["financialStrategy", "Financial Strategy"],
  ["illustration1", "Illustration 1"],
  ["illustration2", "Illustration 2"],
  ["supervisionForm", "Supervision Form"],
];
const documents = (uploaded = []) =>
  DOCS.map(([key, label]) => ({ key, label, uploaded: uploaded.includes(key), fileName: uploaded.includes(key) ? `${key}.pdf` : "" }));

const product = (over = {}) => ({
  id: "p1",
  companyId: "1",
  company: "Acme Life",
  productId: "10",
  productName: "TermPlus",
  type: "term",
  accountType: "",
  coverageAmount: "$500,000",
  premium: "$85",
  frequency: "Monthly",
  purpose: "",
  allocations: [],
  ...over,
});
const validData = (over = {}) => ({
  policyOwner: "Grace Hopper",
  insuredPerson: "Grace Hopper",
  canadianStatus: "Citizen",
  province: "Ontario",
  dateOfBirth: "1980-05-05",
  maritalStatus: "",
  occupation: "",
  annualIncome: "",
  dependants: [],
  homeowner: false,
  mortgageBalance: "",
  otherMajorDebt: "",
  needs: ["Life Insurance"],
  otherNeed: "",
  products: [product()],
  investmentProfile: { riskTolerance: "", investmentHorizon: "", investmentObjective: "", sourceOfFunds: "" },
  existingCoverage: [],
  advisorNotes: "",
  reasonWhyLetterText: "Dear Grace, here is why.",
  supervisionConfirmations: {
    applicationReviewed: null,
    needsAnalysisReviewed: null,
    policyIllustrationsReviewed: null,
    lifeInsuranceReplacement: null,
    lirdReviewed: null,
    segFundsLeveraging: null,
    disclosureDocReviewed: null,
  },
  ...over,
});

let server_pkg; // the package "on the server"
let puts;
function serverWith(pkg) {
  server_pkg = {
    id: 1,
    version: 1,
    status: "draft",
    data: validData(),
    documents: documents(),
    insuredPerson: "Grace Hopper",
    policyOwner: "Grace Hopper",
    updatedAt: "2026-01-01T00:00:00Z",
    ...pkg,
  };
  puts = [];
  server.use(
    http.get(`${P}/companies`, () => HttpResponse.json([{ id: 1, name: "Acme Life" }])),
    http.get(`${P}/companies/1/products`, () =>
      HttpResponse.json([
        { id: 10, name: "TermPlus", type: "term" },
        { id: 11, name: "GrowthSeg", type: "segregated_fund" },
      ])
    ),
    http.get(`${P}/companies/1/funds`, () => HttpResponse.json([{ id: 5, name: "Equity Fund" }])),
    http.get(`${P}/packages`, () => HttpResponse.json([server_pkg])),
    http.post(`${P}/packages`, () =>
      HttpResponse.json({ ...server_pkg, id: 2, version: 1, data: validData({ policyOwner: "", insuredPerson: "", products: [] }) })
    ),
    http.get(`${P}/packages/:id`, () => HttpResponse.json(server_pkg)),
    http.put(`${P}/packages/:id`, async ({ request }) => {
      const body = await request.json();
      puts.push(body);
      server_pkg = { ...server_pkg, data: body.data, version: server_pkg.version + 1 };
      return HttpResponse.json(server_pkg);
    })
  );
}

function Where() {
  const { search } = useLocation();
  return <p data-testid="where">{search}</p>;
}
const renderWizard = (route = "/sales?id=1") =>
  renderWithProviders(
    <>
      <SalesPackagePrep />
      <Where />
    </>,
    { route }
  );

const toastText = () => document.querySelector("[role=status]")?.textContent || "";
const stepper = (name) => screen.getByRole("button", { name: new RegExp(name, "i") });
const next = () => userEvent.click(screen.getByRole("button", { name: /^next$/i }));
const waitToast = (re) => waitFor(() => expect(toastText()).toMatch(re));

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  serverWith();
});
afterEach(() => vi.restoreAllMocks());

describe("starting", () => {
  it("opens the wizard on the Client step for a package id in the address", async () => {
    renderWizard();
    expect(await screen.findByText("Client Information")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("Grace Hopper").length).toBeGreaterThan(0); // policy owner and insured person
    expect(screen.getByRole("button", { name: /save draft/i })).toBeInTheDocument();
  });

  it("with no id and no saved packages it creates a draft and puts its id in the address", async () => {
    server.use(http.get(`${P}/packages`, () => HttpResponse.json([])));
    renderWizard("/sales");
    // (putting the id in the address makes the wizard load that package again, so wait for the address first)
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("?id=2"));
    expect(await screen.findByText("Client Information")).toBeInTheDocument();
  });

  it("with saved packages it shows the picker: continue one, delete one, or start a new one", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderWizard("/sales");
    expect(await screen.findByText(/saved sales packages in progress/i)).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    server.use(http.delete(`${P}/packages/1`, () => new HttpResponse(null, { status: 204 })));
    await userEvent.click(screen.getByRole("button", { name: "Delete draft" }));
    await waitFor(() => expect(screen.queryByText("Grace Hopper")).not.toBeInTheDocument());
    await waitToast(/Sales package deleted/);
    await userEvent.click(screen.getByRole("button", { name: /start a new sales package/i }));
    expect(await screen.findByText("Client Information")).toBeInTheDocument();
  });

  it("does not delete when the confirmation is declined", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWizard("/sales");
    await userEvent.click(await screen.findByRole("button", { name: "Delete draft" }));
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
  });

  it("continuing a package from the picker opens it", async () => {
    renderWizard("/sales");
    await userEvent.click(await screen.findByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Client Information")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("?id=1");
  });

  it("says so when the package cannot be loaded", async () => {
    server.use(http.get(`${P}/packages/:id`, () => HttpResponse.json({ error: "Package gone" }, { status: 404 })));
    renderWizard("/sales?id=9");
    await waitToast(/Package gone/);
  });
});

describe("saving and the version", () => {
  it("Next saves the draft with the version the wizard is based on, and the next save uses the new one", async () => {
    renderWizard();
    await screen.findByText("Client Information");
    await next();
    await screen.findByText("Client Needs & Objectives");
    expect(puts).toHaveLength(1);
    expect(puts[0].version).toBe(1);
    expect(puts[0].data.policyOwner).toBe("Grace Hopper");
    await next();
    await screen.findByText("Products Sold / Recommended");
    expect(puts.map((p) => p.version)).toEqual([1, 2]);
  });

  it("Save Draft saves and says so", async () => {
    renderWizard();
    await userEvent.click(await screen.findByRole("button", { name: /save draft/i }));
    await waitToast(/Draft saved/);
    expect(puts).toHaveLength(1);
  });

  it("a stale version (409) shows the server's newer copy instead of overwriting it, and says so", async () => {
    renderWizard();
    await screen.findByText("Client Information");
    server.use(
      http.put(`${P}/packages/:id`, () =>
        HttpResponse.json(
          {
            error: "changed",
            package: { ...server_pkg, version: 7, data: validData({ policyOwner: "Edited Elsewhere", insuredPerson: "Edited Elsewhere" }) },
          },
          { status: 409 }
        )
      )
    );
    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitToast(/changed elsewhere/);
    expect(screen.getAllByDisplayValue("Edited Elsewhere").length).toBeGreaterThan(0);
    // the next save is based on the newer version
    serverWith({ version: 7, data: validData({ policyOwner: "Edited Elsewhere", insuredPerson: "Edited Elsewhere" }) });
    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(puts.at(-1)?.version).toBe(7));
  });

  it("another save failure is reported with the server's message", async () => {
    renderWizard();
    await screen.findByText("Client Information");
    server.use(http.put(`${P}/packages/:id`, () => HttpResponse.json({ error: "Disk full" }, { status: 500 })));
    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitToast(/Disk full/);
  });
});

describe("what blocks moving forward", () => {
  it("a date of birth in the future stops the Client step", async () => {
    server_pkg.data = validData({ dateOfBirth: "2999-01-01" });
    renderWizard();
    await screen.findByText("Client Information");
    await next();
    await waitToast(/Fix the date of birth first/);
    expect(screen.getByText("Client Information")).toBeInTheDocument();
    expect(puts).toHaveLength(0);
  });

  it("a segregated fund needs an account type before leaving the Products step", async () => {
    server_pkg.data = validData({
      products: [product({ type: "segregated_fund", productId: "11", productName: "GrowthSeg", accountType: "" })],
    });
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("products"));
    await screen.findByText("Products Sold / Recommended");
    await next();
    await waitToast(/Choose an Account Type for GrowthSeg/);
  });

  it("fund allocations must total 100% before leaving the Products step", async () => {
    server_pkg.data = validData({
      products: [
        product({
          type: "segregated_fund",
          productId: "11",
          productName: "GrowthSeg",
          accountType: "RRSP",
          allocations: [{ id: "a1", fundId: "5", fundName: "Equity Fund", allocationPct: "60" }],
        }),
      ],
    });
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("products"));
    await screen.findByText("Products Sold / Recommended");
    await next();
    await waitToast(/allocations must total 100%/);
  });

  it("allocations that total 100% let the wizard move on", async () => {
    server_pkg.data = validData({
      products: [
        product({
          type: "segregated_fund",
          productId: "11",
          productName: "GrowthSeg",
          accountType: "RRSP",
          allocations: [{ id: "a1", fundId: "5", fundName: "Equity Fund", allocationPct: "100" }],
        }),
      ],
    });
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("products"));
    await screen.findByText("Products Sold / Recommended");
    await next();
    await screen.findByText("Investment Profile");
  });

  it("the Reason Why Letter must exist before leaving its step", async () => {
    server_pkg.data = validData({ reasonWhyLetterText: "" });
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("reason why letter"));
    await screen.findByRole("button", { name: /generate draft/i });
    await next();
    await waitToast(/Generate and save the Reason Why Letter/);
  });

  it("every compliance confirmation must be answered before leaving the Compliance step", async () => {
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("compliance"));
    await screen.findByText("Your Compliance Profile");
    await next();
    await waitToast(/Answer all compliance confirmation questions/);
    // answer them all (the follow-ups only when their parent is Yes), then it moves on
    for (const q of [
      "Insurance Application reviewed?",
      "Needs Analysis reviewed?",
      "Policy Illustrations reviewed?",
      "Is this a Life Insurance Replacement?",
      "Segregated Funds Leveraging?",
    ]) {
      const row = screen.getByText(q).closest("div");
      await userEvent.click(within(row).getAllByRole("radio")[1]); // No
    }
    await next();
    await screen.findByText("Documents We Prepare For You");
  });
});

describe("the Reason Why Letter", () => {
  it("drafts the letter with AI into the editor, and saves it with the version", async () => {
    server_pkg.data = validData({ reasonWhyLetterText: "" });
    server.use(
      http.post(`${P}/packages/:id/reason-why-letter`, () => HttpResponse.json({ text: "Drafted letter text" })),
      http.put(`${P}/packages/:id/reason-why-letter`, async ({ request }) => {
        const body = await request.json();
        puts.push({ letter: body });
        server_pkg = { ...server_pkg, version: 5 };
        return HttpResponse.json({ ...server_pkg, status: "draft", documents: documents(["reasonWhyLetter"]) });
      })
    );
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("reason why letter"));
    await userEvent.click(await screen.findByRole("button", { name: /generate draft/i }));
    await userEvent.click(await screen.findByRole("button", { name: /edit text/i }));
    expect(screen.getByDisplayValue("Drafted letter text")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /save letter/i }));
    await waitToast(/Reason Why Letter saved/);
    // jumping from step 1 to the letter step saved the draft first (version 1 -> 2), so the letter is saved against version 2
    expect(puts.at(-1).letter).toEqual({ text: "Drafted letter text", version: 2 });
  });

  it("an out-of-credit answer is explained on the page, not flashed as a toast", async () => {
    server.use(
      http.post(`${P}/packages/:id/reason-why-letter`, () =>
        HttpResponse.json(
          { error: "Your AI wallet balance is too low for this. Top up in Profile.", code: "ai_credit_exhausted", actions: ["top_up"] },
          { status: 402 }
        )
      )
    );
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("reason why letter"));
    await userEvent.click(await screen.findByRole("button", { name: /regenerate draft|generate draft/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your AI wallet balance is too low");
    expect(screen.getByRole("link", { name: "Add credit" })).toBeInTheDocument();
    expect(toastText()).not.toMatch(/wallet balance/);
  });

  it("another drafting failure is a toast with the server's message", async () => {
    server.use(http.post(`${P}/packages/:id/reason-why-letter`, () => HttpResponse.json({ error: "Provider error" }, { status: 502 })));
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("reason why letter"));
    await userEvent.click(await screen.findByRole("button", { name: /regenerate draft|generate draft/i }));
    await waitToast(/Provider error/);
  });
});

describe("documents", () => {
  const goToDocuments = async () => {
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("documents"));
    await screen.findByText("Upload Documents");
  };
  const fileInputs = () => [...document.querySelectorAll("input[type=file]")];
  const pick = (input, file) => userEvent.upload(input, file, { applyAccept: false });

  it("lists every document to upload, and shows which are done", async () => {
    server_pkg.documents = documents(["fna"]);
    await goToDocuments();
    expect(fileInputs()).toHaveLength(7);
    expect(screen.getByText("fna.pdf")).toBeInTheDocument();
  });

  it("refuses a file that is not a PDF (a Word file is allowed only for the letter)", async () => {
    await goToDocuments();
    await pick(fileInputs()[2], new File(["x"], "fna.docx")); // FNA: PDF only
    await waitToast(/FNA must be a PDF file/);
    await pick(fileInputs()[1], new File(["x"], "scan.txt")); // the letter
    await waitToast(/Reason Why Letter must be a PDF or Word/);
  });

  it("refuses a file over 10 MB", async () => {
    await goToDocuments();
    const big = new File(["x"], "big.pdf");
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
    await pick(fileInputs()[2], big);
    await waitToast(/FNA is larger than 10 MB/);
  });

  it("uploads a PDF and marks the document uploaded", async () => {
    // The transport (an XMLHttpRequest, for upload progress) is not the wizard's concern and jsdom cannot complete one.
    const upload = vi.spyOn(api, "uploadSalesPackageDocument").mockImplementation(async (id, key, file, onProgress) => {
      onProgress?.(50);
      return { ...server_pkg, documents: documents(["fna"]) };
    });
    await goToDocuments();
    await pick(fileInputs()[2], new File(["%PDF"], "my-fna.pdf", { type: "application/pdf" }));
    await waitToast(/FNA uploaded/);
    expect(upload).toHaveBeenCalledWith("1", "fna", expect.any(File), expect.any(Function));
    await waitFor(() => expect(screen.getByText("fna.pdf")).toBeInTheDocument());
  });

  it("generates the Agent Disclosure Form and attaches it", async () => {
    server.use(
      http.post(`${P}/packages/:id/agent-disclosure`, () =>
        HttpResponse.json({ ...server_pkg, documents: documents(["agentDisclosureForm"]) })
      )
    );
    await goToDocuments();
    const card = screen.getByText("Agent Disclosure Form", { selector: "p, span, h3" }).closest("div");
    await userEvent.click(within(card.parentElement).getByRole("button", { name: /generate/i }));
    await waitToast(/Agent Disclosure Form generated and attached/);
  });

  it("generates the Supervision Form with the compliance answers", async () => {
    let body;
    server.use(
      http.post(`${P}/packages/:id/supervision-form`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...server_pkg, documents: documents(["supervisionForm"]) });
      })
    );
    await goToDocuments();
    const cards = screen.getAllByRole("button", { name: /generate/i });
    await userEvent.click(cards[cards.length - 1]);
    await waitToast(/Supervision Form generated and attached/);
    expect(body).toHaveProperty("applicationReviewed");
  });
});

describe("review and generate", () => {
  const toReview = async () => {
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("review"));
    await screen.findByText("Review & Generate");
  };

  it("lists what is not ready, and keeps Generate disabled until it is", async () => {
    await toReview();
    expect(screen.getByText(/Not ready to generate yet/)).toBeInTheDocument();
    expect(screen.getByText("FNA hasn't been uploaded yet (Documents step)")).toBeInTheDocument();
    expect(screen.getByText("Check the confirmation box below")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate Package" })).toBeDisabled();
  });

  it("with everything uploaded and confirmed it saves, confirms and generates, then offers DocuSeal", async () => {
    server_pkg.documents = documents(DOCS.map(([k]) => k));
    const calls = [];
    server.use(
      http.post(`${P}/packages/:id/confirm`, () => {
        calls.push("confirm");
        return HttpResponse.json({});
      }),
      http.post(`${P}/packages/:id/generate`, () => {
        calls.push("generate");
        return new HttpResponse("%PDF", {
          headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="pkg.pdf"' },
        });
      })
    );
    window.URL.createObjectURL = vi.fn(() => "blob:x");
    window.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await toReview();
    await userEvent.click(screen.getByRole("checkbox", { name: /I have reviewed the information above/i }));
    const generate = screen.getByRole("button", { name: "Generate Package" });
    await waitFor(() => expect(generate).toBeEnabled());
    await userEvent.click(generate);
    await waitToast(/Sales package generated/);
    expect(puts.length).toBeGreaterThan(0); // it saved first
    expect(calls).toEqual(["confirm", "generate"]);
    expect(await screen.findByRole("button", { name: "Regenerate Package" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open docuseal/i })).toHaveAttribute("href", "https://docuseal.com");
  });

  it("never generates from data it could not save", async () => {
    server_pkg.documents = documents(DOCS.map(([k]) => k));
    let confirmed = false;
    server.use(
      http.put(`${P}/packages/:id`, () => HttpResponse.json({ error: "Disk full" }, { status: 500 })),
      http.post(`${P}/packages/:id/confirm`, () => {
        confirmed = true;
        return HttpResponse.json({});
      })
    );
    await toReview();
    await userEvent.click(screen.getByRole("checkbox", { name: /I have reviewed the information above/i }));
    await userEvent.click(screen.getByRole("button", { name: "Generate Package" }));
    await waitToast(/Disk full/);
    expect(confirmed).toBe(false);
  });

  it("shows a generation failure on the page", async () => {
    server_pkg.documents = documents(DOCS.map(([k]) => k));
    server.use(http.post(`${P}/packages/:id/confirm`, () => HttpResponse.json({ error: "Missing signature page" }, { status: 400 })));
    await toReview();
    await userEvent.click(screen.getByRole("checkbox", { name: /I have reviewed the information above/i }));
    await userEvent.click(screen.getByRole("button", { name: "Generate Package" }));
    expect(await screen.findByText("Missing signature page")).toBeInTheDocument();
  });
});

describe("the stepper", () => {
  it("marks complete steps, and lets the advisor jump to any step", async () => {
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("needs"));
    expect(await screen.findByText("Client Needs & Objectives")).toBeInTheDocument();
    await userEvent.click(stepper("client"));
    expect(await screen.findByText("Client Information")).toBeInTheDocument();
  });

  it("Back is disabled on the first step and Next is gone on the last", async () => {
    renderWizard();
    await screen.findByText("Client Information");
    expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();
    await userEvent.click(stepper("review"));
    await screen.findByText("Review & Generate");
    expect(screen.queryByRole("button", { name: /^next$/i })).not.toBeInTheDocument();
  });
});
