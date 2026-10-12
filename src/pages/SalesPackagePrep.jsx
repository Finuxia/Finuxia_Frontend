import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { INVESTMENT_BEARING_TYPES } from "../lib/salesPackageOptions";
import { STEPS, advanceBlocker, computeStepStates } from "../lib/salesPackage/wizard";
import useSalesPackageCatalog from "../hooks/useSalesPackageCatalog";
import useSalesPackageDraft from "../hooks/useSalesPackageDraft";
import useSalesPackageActions from "../hooks/useSalesPackageActions";
import useDocumentUploads from "../hooks/useDocumentUploads";
import useProductRows from "../hooks/useProductRows";
import Stepper from "../components/sales-package/Stepper";
import PackagePicker from "../components/sales-package/PackagePicker";
import ClientStep from "../components/sales-package/ClientStep";
import NeedsStep from "../components/sales-package/NeedsStep";
import ProductsStep from "../components/sales-package/ProductsStep";
import DetailsStep from "../components/sales-package/DetailsStep";
import LetterStep from "../components/sales-package/LetterStep";
import ComplianceStep from "../components/sales-package/ComplianceStep";
import DocumentsStep from "../components/sales-package/DocumentsStep";
import ReviewStep from "../components/sales-package/ReviewStep";

/**
 * The Sales Package Prep wizard. This page decides what to show (loading, the list of the advisor's packages, or the
 * wizard) and which step is open; the draft itself lives in useSalesPackageDraft, the file uploads in useDocumentUploads,
 * the server-side document actions in useSalesPackageActions, and each step is its own component.
 */
export default function SalesPackagePrep() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const packageId = searchParams.get("id");

  const [mode, setMode] = useState("loading"); // loading | picker | wizard
  const [myPackages, setMyPackages] = useState([]);
  const [step, setStep] = useState(0);
  const [visited, setVisited] = useState(() => new Set([0]));
  const [confirmChecked, setConfirmChecked] = useState(false);

  const catalog = useSalesPackageCatalog();
  const draft = useSalesPackageDraft({
    packageId,
    catalog,
    onLoaded: () => {
      setConfirmChecked(false);
      setStep(0);
      setVisited(new Set([0]));
    },
  });
  const { data, patch, documents } = draft;
  const rows = useProductRows({ draft, catalog });
  const uploads = useDocumentUploads({ packageId, applyDocuments: draft.applyDocuments });
  const actions = useSalesPackageActions({ packageId, draft });

  // --- bootstrap ---
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (packageId) {
        setMode("loading");
        try {
          const pkg = await api.getSalesPackage(packageId);
          if (cancelled) return;
          draft.loadPackageInto(pkg);
          setMode("wizard");
        } catch (err) {
          if (!cancelled) addToast(err.message || "Could not load this sales package.");
        }
        return;
      }
      setMode("loading");
      try {
        const list = await api.getSalesPackages();
        if (cancelled) return;
        if (list.length > 0) {
          setMyPackages(list);
          setMode("picker");
        } else {
          await startNewDraft();
        }
      } catch (err) {
        if (!cancelled) addToast(err.message || "Could not load your sales packages.");
      }
    }
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once per package id; startNewDraft, loadPackageInto and addToast are not stable and must not retrigger it
  }, [packageId]);

  const openPackage = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set("id", String(id));
    setSearchParams(next, { replace: true });
  };

  const startNewDraft = async () => {
    try {
      const created = await api.createSalesPackage();
      openPackage(created.id);
      draft.loadPackageInto(created);
      setMode("wizard");
    } catch (err) {
      addToast(err.message || "Could not start a new sales package.");
    }
  };

  const deleteDraft = async (id, label) => {
    if (!window.confirm(`Delete "${label || "this draft"}"? This can't be undone.`)) return;
    try {
      await api.deleteSalesPackage(id);
      setMyPackages((list) => list.filter((p) => p.id !== id));
      addToast("Sales package deleted");
    } catch (err) {
      addToast(err.message || "Could not delete this sales package");
    }
  };

  const goStep = async (next) => {
    const blocker = next > step ? advanceBlocker(step, data) : null;
    if (blocker) {
      addToast(blocker);
      return;
    }
    await draft.saveDraft({ silent: true });
    setStep(next);
    setVisited((v) => new Set(v).add(next));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (mode === "loading") {
    return <div className="py-20 text-center text-sm text-slate-400">Loading...</div>;
  }

  if (mode === "picker") {
    return <PackagePicker packages={myPackages} onResume={openPackage} onDelete={deleteDraft} onStartNew={startNewDraft} />;
  }

  const stepStatuses = computeStepStates({ data, documents, status: draft.status }).map((st, i) => {
    const done = st.complete && (!st.needsVisit || visited.has(i));
    if (done) return "complete";
    return st.started || visited.has(i) ? "incomplete" : "pending";
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Sales Package Prep</h1>
          <p className="text-sm text-slate-500">
            Enter client information, select products, upload documents, and create a complete package.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => draft.saveDraft()}
            disabled={draft.saving}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-navy transition hover:bg-slate-50 disabled:opacity-60"
          >
            <Save size={14} />
            {draft.saving ? "Saving..." : "Save Draft"}
          </button>
        </div>
      </div>

      <Stepper steps={STEPS} current={step} statuses={stepStatuses} onSelect={goStep} />

      {step === 0 && <ClientStep data={data} patch={patch} />}
      {step === 1 && <NeedsStep data={data} patch={patch} />}
      {step === 2 && (
        <ProductsStep
          data={data}
          companies={catalog.companies}
          productsByCompany={catalog.productsByCompany}
          fundsByKey={catalog.fundsByKey}
          onAddProduct={rows.addProduct}
          onRemoveProduct={rows.removeProduct}
          onCompanyChange={rows.changeCompany}
          onProductChange={rows.changeProduct}
          onFieldChange={rows.updateProduct}
          onAddAllocation={rows.addAllocation}
          onUpdateAllocation={rows.updateAllocation}
          onRemoveAllocation={rows.removeAllocation}
        />
      )}
      {step === 3 && (
        <DetailsStep data={data} patch={patch} hasInvestmentProduct={data.products.some((p) => INVESTMENT_BEARING_TYPES.has(p.type))} />
      )}
      {step === 4 && (
        <LetterStep
          data={data}
          patch={patch}
          letterDoc={documents.find((d) => d.key === "reasonWhyLetter")}
          onDownload={actions.downloadDocument}
          onDownloadLetterPdf={actions.downloadLetterPdf}
          onDraftLetter={actions.draftLetter}
          letterDrafting={actions.letterDrafting}
          onSaveLetter={actions.saveLetter}
        />
      )}
      {step === 5 && <ComplianceStep data={data} patch={patch} profile={user} />}
      {step === 6 && (
        <DocumentsStep
          documents={documents}
          uploadProgress={uploads.uploadProgress}
          onUpload={uploads.uploadDocument}
          onDownload={actions.downloadDocument}
          onDownloadLetterPdf={actions.downloadLetterPdf}
          onGenerateDisclosure={actions.generateDisclosure}
          disclosureGenerating={actions.disclosureGenerating}
          onGenerateSupervisionForm={actions.generateSupervisionForm}
          supervisionGenerating={actions.supervisionGenerating}
        />
      )}
      {step === 7 && (
        <ReviewStep
          data={data}
          patch={patch}
          packageId={packageId}
          docVersion={draft.docVersion}
          uploadProgress={uploads.uploadProgress}
          advisorName={user?.name}
          documents={documents}
          onUpload={uploads.uploadDocument}
          onDownload={actions.downloadDocument}
          onSaveLetter={actions.saveLetter}
          confirmChecked={confirmChecked}
          setConfirmChecked={setConfirmChecked}
          onGenerate={actions.generatePackage}
          generating={actions.generating}
          error={actions.error}
          status={draft.status}
        />
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => goStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
        >
          <ChevronLeft size={15} />
          Back
        </button>
        {step < STEPS.length - 1 && (
          <button
            type="button"
            onClick={() => goStep(Math.min(STEPS.length - 1, step + 1))}
            className="flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light"
          >
            Next
            <ChevronRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
