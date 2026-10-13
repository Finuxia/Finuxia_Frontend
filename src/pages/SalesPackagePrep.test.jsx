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

// The toast box has no role on this branch's base (the accessible live region comes with the shared UI primitives), so it is found by where it sits.
const toastText = () => document.querySelector(".fixed.bottom-5.right-5")?.textContent || "";
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
    // (putting the id in the address makes the wizard load that package again, so wait for the address first, and then for the wizard to
    // be there for good: it shows for a moment, is replaced by "Loading..." while the package is fetched, and comes back, so a one-off
    // find could catch the first appearance and then assert on an element that has already been removed)
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("?id=2"));
    await waitFor(() => expect(screen.getByText("Client Information")).toBeInTheDocument());
  });

  it("with saved packages it shows the picker: continue one, delete one, or start a new one", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderWizard("/sales");
    expect(await screen.findByText(/saved sales packages in progress/i)).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    server.use(http.delete(`${P}/packages/1`, () => new HttpResponse(null, { status: 204 })));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByText("Grace Hopper")).not.toBeInTheDocument());
    await waitToast(/Sales package deleted/);
    await userEvent.click(screen.getByRole("button", { name: /start a new sales package/i }));
    expect(await screen.findByText("Client Information")).toBeInTheDocument();
  });

  it("does not delete when the confirmation is declined", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWizard("/sales");
    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
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

  it("an error that merely carries a package is not a version conflict: nothing is replaced", async () => {
    renderWizard();
    await screen.findByText("Client Information");
    server.use(
      http.put(`${P}/packages/:id`, () =>
        HttpResponse.json(
          {
            error: "Upstream trouble",
            package: { ...server_pkg, version: 9, data: validData({ policyOwner: "Somebody Else", insuredPerson: "Somebody Else" }) },
          },
          { status: 502 }
        )
      )
    );
    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitToast(/Upstream trouble/);
    expect(toastText()).not.toMatch(/changed elsewhere/);
    expect(screen.queryByDisplayValue("Somebody Else")).not.toBeInTheDocument();
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
    await screen.findByText("Existing Insurance & Investments");
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

// Added while splitting the page, after mutation checks showed these behaviours were not yet pinned. They pass on the
// monolith too: they describe what it always did.
describe("details the split must keep", () => {
  const conflict = (over = {}) =>
    http.put(`${P}/packages/:id`, () =>
      HttpResponse.json(
        { error: "changed", package: { ...server_pkg, version: 7, data: validData({ policyOwner: "Edited Elsewhere", ...over }) } },
        { status: 409 }
      )
    );
  const labelColour = (name) => stepper(name).querySelector("span.text-sm").className;

  it("a conflict reload starts the advisor again on the first step, with nothing marked as visited", async () => {
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("details"));
    await screen.findByText("Existing Insurance & Investments");
    expect(labelColour("details")).toContain("text-navy"); // the open step
    await userEvent.click(stepper("needs"));
    await screen.findByText("Client Needs & Objectives");
    expect(labelColour("details")).toContain("text-av-green"); // visited, and nothing is required on it
    server.use(conflict());
    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitToast(/changed elsewhere/);
    // one message, not the server's raw error on top of it
    expect(toastText()).toBe("This package was changed elsewhere — showing the latest version. Re-apply your edits if needed.");
    expect(await screen.findByText("Client Information")).toBeInTheDocument();
    expect(labelColour("details")).toContain("text-slate-400"); // not visited any more
  });

  it("a step with nothing required counts as done only once it has been visited", async () => {
    renderWizard();
    await screen.findByText("Client Information");
    expect(labelColour("details")).toContain("text-slate-400");
    await userEvent.click(stepper("details"));
    await userEvent.click(stepper("client"));
    expect(labelColour("details")).toContain("text-av-green");
  });

  it("a conflict also clears the review confirmation", async () => {
    server_pkg.documents = documents(DOCS.map(([k]) => k));
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("review"));
    const box = await screen.findByRole("checkbox", { name: /I have reviewed the information above/i });
    await userEvent.click(box);
    expect(box).toBeChecked();
    server.use(conflict());
    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitToast(/changed elsewhere/);
    await userEvent.click(stepper("review"));
    expect(await screen.findByRole("checkbox", { name: /I have reviewed the information above/i })).not.toBeChecked();
  });

  it("a reopened draft shows its saved product, not a blank dropdown", async () => {
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("products"));
    await screen.findByText("Products Sold / Recommended");
    await waitFor(() => expect(screen.getByDisplayValue("TermPlus")).toBeInTheDocument());
  });

  it("a reopened investment product has its funds loaded for the allocation dropdown", async () => {
    let fundsAsked = 0;
    server.use(
      http.get(`${P}/companies/1/funds`, () => {
        fundsAsked += 1;
        return HttpResponse.json([{ id: 5, name: "Equity Fund" }]);
      })
    );
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
    await waitFor(() => expect(fundsAsked).toBe(1));
  });

  it("a package with no products still offers one empty product row", async () => {
    server_pkg.data = validData({ products: [] });
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("products"));
    await screen.findByText("Products Sold / Recommended");
    expect(screen.getAllByRole("option", { name: "Select Company" })).toHaveLength(1);
  });

  it("the last product row cannot be removed, but one of several can", async () => {
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("products"));
    await screen.findByDisplayValue("TermPlus");
    const trash = () => [...document.querySelectorAll("button svg[class*=trash]")].map((i) => i.closest("button"));
    await userEvent.click(trash()[0]);
    expect(screen.getByDisplayValue("TermPlus")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /add another product/i }));
    await waitFor(() => expect(screen.getAllByRole("option", { name: "Select Company" })).toHaveLength(2));
    await userEvent.click(trash()[0]);
    await waitFor(() => expect(screen.getAllByRole("option", { name: "Select Company" })).toHaveLength(1));
    expect(screen.queryByDisplayValue("TermPlus")).not.toBeInTheDocument();
  });

  it("choosing another company resets everything that depended on the old one", async () => {
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
    await screen.findByDisplayValue("GrowthSeg");
    await userEvent.selectOptions(screen.getByDisplayValue("Acme Life"), "");
    await userEvent.selectOptions(screen.getByDisplayValue("Select Company"), "1");
    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(puts).toHaveLength(2)); // the first is the save when jumping to Products
    expect(puts[1].data.products[0]).toMatchObject({
      companyId: "1",
      company: "Acme Life",
      productId: "",
      productName: "",
      type: "",
      accountType: "",
      allocations: [],
    });
  });

  const segFund = (allocations) =>
    product({ type: "segregated_fund", productId: "11", productName: "GrowthSeg", accountType: "RRSP", allocations });

  it("choosing another product clears the account type and allocations of the old one", async () => {
    server_pkg.data = validData({ products: [segFund([{ id: "a1", fundId: "5", fundName: "Equity Fund", allocationPct: "100" }])] });
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("products"));
    await userEvent.selectOptions(await screen.findByDisplayValue("GrowthSeg"), "10");
    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(puts).toHaveLength(2));
    expect(puts[1].data.products[0]).toMatchObject({
      productId: "10",
      productName: "TermPlus",
      type: "term",
      accountType: "",
      allocations: [],
    });
  });

  it("choosing an investment product loads its funds and offers the allocation section", async () => {
    let fundsAsked = 0;
    server.use(
      http.get(`${P}/companies/1/funds`, () => {
        fundsAsked += 1;
        return HttpResponse.json([{ id: 5, name: "Equity Fund" }]);
      })
    );
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("products"));
    await userEvent.selectOptions(await screen.findByDisplayValue("TermPlus"), "11");
    expect(await screen.findByText(/Fund Allocation — GrowthSeg/)).toBeInTheDocument();
    await waitFor(() => expect(fundsAsked).toBe(1));
  });

  it("fund allocations can be added, edited and removed", async () => {
    server_pkg.data = validData({ products: [segFund([{ id: "a1", fundId: "5", fundName: "Equity Fund", allocationPct: "60" }])] });
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("products"));
    await screen.findByText("60% allocated");
    await userEvent.click(screen.getByRole("button", { name: "Add Another Fund" }));
    const pct = () => screen.getAllByRole("spinbutton");
    // the product's own amount fields are text inputs, so these are just the allocation percentages
    expect(pct()).toHaveLength(2);
    await userEvent.type(pct()[1], "40");
    await screen.findByText("100% allocated");
    const trash = () => [...document.querySelectorAll("button svg[class*=trash]")].map((i) => i.closest("button"));
    await userEvent.click(trash()[1]); // the first allocation's remove (trash()[0] removes the product)
    await screen.findByText("40% allocated");
    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(puts).toHaveLength(2));
    expect(puts[1].data.products[0].allocations).toEqual([expect.objectContaining({ allocationPct: "40" })]);
  });

  it("allocations that are only half a percent short still block", async () => {
    server_pkg.data = validData({
      products: [
        product({
          type: "segregated_fund",
          productId: "11",
          productName: "GrowthSeg",
          accountType: "RRSP",
          allocations: [{ id: "a1", fundId: "5", fundName: "Equity Fund", allocationPct: "99.5" }],
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

  it("clicking the step you are already on is not a move forward, so it is not blocked", async () => {
    server_pkg.data = validData({ dateOfBirth: "2999-01-01" });
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("client"));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(toastText()).not.toMatch(/date of birth/i);
  });

  it("a letter save that meets a conflict shows the newer package and says so", async () => {
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("reason why letter"));
    server.use(
      http.put(`${P}/packages/:id/reason-why-letter`, () =>
        HttpResponse.json(
          { error: "changed", package: { ...server_pkg, version: 9, data: validData({ reasonWhyLetterText: "Newer letter" }) } },
          { status: 409 }
        )
      )
    );
    await userEvent.click(await screen.findByRole("button", { name: /save letter/i }));
    await waitToast(/changed elsewhere/);
    expect(await screen.findByText("Client Information")).toBeInTheDocument();
  });

  it("a letter save that fails otherwise says why", async () => {
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("reason why letter"));
    server.use(http.put(`${P}/packages/:id/reason-why-letter`, () => HttpResponse.json({ error: "Letter too long" }, { status: 400 })));
    await userEvent.click(await screen.findByRole("button", { name: /save letter/i }));
    await waitToast(/Letter too long/);
  });

  it("saving the letter takes the package's new documents (the letter can then be downloaded)", async () => {
    server.use(
      http.put(`${P}/packages/:id/reason-why-letter`, () =>
        HttpResponse.json({
          ...server_pkg,
          version: 5,
          documents: documents(["reasonWhyLetter"]).map((d) =>
            d.key === "reasonWhyLetter" ? { ...d, generatedFileName: "letter.docx" } : d
          ),
        })
      )
    );
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("reason why letter"));
    expect(screen.queryByRole("button", { name: /download pdf/i })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: /save letter/i }));
    expect(await screen.findByRole("button", { name: /download pdf/i })).toBeInTheDocument();
  });

  it("saving the letter advances the package version and status", async () => {
    server_pkg.status = "completed";
    server.use(
      http.put(`${P}/packages/:id/reason-why-letter`, () => {
        server_pkg = { ...server_pkg, version: 5, status: "draft" };
        return HttpResponse.json(server_pkg);
      })
    );
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("review"));
    expect(await screen.findByRole("button", { name: "Regenerate Package" })).toBeInTheDocument();
    await userEvent.click(stepper("reason why letter"));
    await userEvent.click(await screen.findByRole("button", { name: /save letter/i }));
    await waitToast(/Reason Why Letter saved/);
    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(puts.at(-1)?.version).toBe(5));
    await userEvent.click(stepper("review"));
    expect(await screen.findByRole("button", { name: "Generate Package" })).toBeInTheDocument();
  });

  it("only the letter's file chooser accepts a Word file", async () => {
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("documents"));
    await screen.findByText("Upload Documents");
    const accepts = [...document.querySelectorAll("input[type=file]")].map((i) => i.getAttribute("accept"));
    expect(accepts.filter((a) => a.includes(".docx"))).toHaveLength(1);
    expect(accepts[1]).toContain(".docx");
  });

  it("the upload progress bar goes away when the upload ends", async () => {
    let finish;
    vi.spyOn(api, "uploadSalesPackageDocument").mockImplementation(
      (id, key, file, onProgress) =>
        new Promise((resolve) => {
          onProgress?.(40);
          finish = () => resolve({ ...server_pkg, documents: documents(["fna"]) });
        })
    );
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("documents"));
    await screen.findByText("Upload Documents");
    const input = [...document.querySelectorAll("input[type=file]")][2];
    await userEvent.upload(input, new File(["%PDF"], "f.pdf", { type: "application/pdf" }), { applyAccept: false });
    await waitFor(() => expect(document.querySelector("[style*='width: 40%']")).toBeInTheDocument());
    finish();
    await waitFor(() => expect(document.querySelector("[style*='width: 40%']")).not.toBeInTheDocument());
  });

  it("a Word letter is uploaded and says it was converted to PDF", async () => {
    vi.spyOn(api, "uploadSalesPackageDocument").mockResolvedValue({ ...server_pkg, documents: documents(["reasonWhyLetter"]) });
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("documents"));
    await screen.findByText("Upload Documents");
    const input = [...document.querySelectorAll("input[type=file]")][1];
    await userEvent.upload(input, new File(["x"], "letter.docx"), { applyAccept: false });
    await waitToast(/Reason Why Letter uploaded and converted to PDF/);
  });

  it("a failed upload says why", async () => {
    vi.spyOn(api, "uploadSalesPackageDocument").mockRejectedValue(new Error("Virus found"));
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("documents"));
    await screen.findByText("Upload Documents");
    const input = [...document.querySelectorAll("input[type=file]")][2];
    await userEvent.upload(input, new File(["%PDF"], "f.pdf", { type: "application/pdf" }), { applyAccept: false });
    await waitToast(/Virus found/);
  });

  describe("the generated file's name", () => {
    const generateWith = async (insuredPerson) => {
      server_pkg.data = validData({ insuredPerson });
      server_pkg.documents = documents(DOCS.map(([k]) => k));
      vi.spyOn(api, "confirmSalesPackage").mockResolvedValue({});
      const generate = vi.spyOn(api, "generateSalesPackage").mockResolvedValue({});
      renderWizard();
      await screen.findByText("Client Information");
      await userEvent.click(stepper("review"));
      await userEvent.click(await screen.findByRole("checkbox", { name: /I have reviewed the information above/i }));
      const button = screen.getByRole("button", { name: "Generate Package" });
      await waitFor(() => expect(button).toBeEnabled());
      await userEvent.click(button);
      await waitToast(/Sales package generated/);
      return generate.mock.calls[0][1];
    };

    it("is the insured person's name with underscores", async () => {
      expect(await generateWith("  Grace   Hopper ")).toBe("Grace_Hopper_DocuSeal_Package.pdf");
    });
  });

  it("downloading a document names the file after its label", async () => {
    const download = vi.spyOn(api, "downloadSalesPackageDocument").mockResolvedValue();
    server_pkg.documents = documents().map((d) => (d.key === "agentDisclosureForm" ? { ...d, generatedFileName: "form.pdf" } : d));
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("documents"));
    await screen.findByText("Upload Documents");
    await userEvent.click(screen.getByRole("button", { name: "Download" }));
    await waitFor(() => expect(download).toHaveBeenCalledWith("1", "agentDisclosureForm", "Agent_Disclosure_Form.pdf", true));
  });

  it("a failed download says why", async () => {
    vi.spyOn(api, "downloadSalesPackageDocument").mockRejectedValue(new Error("File missing"));
    server_pkg.documents = documents().map((d) => (d.key === "agentDisclosureForm" ? { ...d, generatedFileName: "form.pdf" } : d));
    renderWizard();
    await screen.findByText("Client Information");
    await userEvent.click(stepper("documents"));
    await screen.findByText("Upload Documents");
    await userEvent.click(screen.getByRole("button", { name: "Download" }));
    await waitToast(/File missing/);
  });
});
