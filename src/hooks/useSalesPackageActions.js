import { useState } from "react";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { isAiBlocked } from "../lib/aiUsage";

/**
 * The things the wizard asks the server to do with the package's documents: draft and save the Reason Why Letter, generate
 * the Agent Disclosure and Supervision forms, download a document, and generate the final package. Each reports its own
 * progress and outcome (a toast). A letter draft the account cannot pay for is not a toast: `letterBlocked` holds the refusal (which limit, and the way out)
 * for the page to show, and `onAiUsed` is called after every draft so the usage warning stays current.
 */
export default function useSalesPackageActions({ packageId, draft, onAiUsed }) {
  const { addToast } = useToast();
  const [letterDrafting, setLetterDrafting] = useState(false);
  const [letterBlocked, setLetterBlocked] = useState(null);
  const [disclosureGenerating, setDisclosureGenerating] = useState(false);
  const [supervisionGenerating, setSupervisionGenerating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const draftLetter = async () => {
    setLetterDrafting(true);
    setLetterBlocked(null);
    try {
      const { text } = await api.draftReasonWhyLetter(packageId);
      draft.patch({ reasonWhyLetterText: text });
    } catch (err) {
      if (isAiBlocked(err)) setLetterBlocked(err);
      else addToast(err.message || "Could not draft the Reason Why Letter");
    } finally {
      setLetterDrafting(false);
      onAiUsed?.();
    }
  };

  const saveLetter = async () => {
    try {
      const pkg = await api.saveReasonWhyLetter(packageId, draft.data.reasonWhyLetterText, draft.versionRef.current);
      // The letter is part of the package, so saving it advanced the package version.
      draft.acceptServerPackage(pkg);
      addToast("Reason Why Letter saved");
    } catch (err) {
      if (!draft.handleConflict(err)) addToast(err.message || "Could not save the letter");
    }
  };

  const generateDisclosure = async () => {
    setDisclosureGenerating(true);
    try {
      const pkg = await api.generateAgentDisclosure(packageId);
      draft.applyDocuments(pkg.documents);
      addToast("Agent Disclosure Form generated and attached");
    } catch (err) {
      addToast(err.message || "Could not generate the Agent Disclosure Form");
    } finally {
      setDisclosureGenerating(false);
    }
  };

  const generateSupervisionForm = async () => {
    setSupervisionGenerating(true);
    try {
      const pkg = await api.generateSupervisionForm(packageId, draft.data.supervisionConfirmations);
      draft.applyDocuments(pkg.documents);
      addToast("Supervision Form generated and attached");
    } catch (err) {
      addToast(err.message || "Could not generate the Supervision Form");
    } finally {
      setSupervisionGenerating(false);
    }
  };

  const downloadDocument = async (key, label, generated = false) => {
    try {
      await api.downloadSalesPackageDocument(packageId, key, `${label.replace(/\s+/g, "_")}.pdf`, generated);
    } catch (err) {
      addToast(err.message || `Could not download ${label}`);
    }
  };

  const downloadLetterPdf = async () => {
    try {
      await api.downloadReasonWhyLetterPdf(packageId);
    } catch (err) {
      addToast(err.message || "Could not download the letter");
    }
  };

  const generatePackage = async () => {
    setError("");
    // Never confirm/generate from data that wasn't saved (e.g. a version conflict reloaded newer data).
    if (!(await draft.saveDraft({ silent: true }))) return;
    setGenerating(true);
    try {
      await api.confirmSalesPackage(packageId);
      const insured = (draft.data.insuredPerson || "Client").trim().replace(/\s+/g, "_");
      await api.generateSalesPackage(packageId, `${insured}_DocuSeal_Package.pdf`);
      draft.setStatus("completed");
      addToast("Sales package generated");
    } catch (err) {
      setError(err.message || "Could not generate the sales package.");
    } finally {
      setGenerating(false);
    }
  };

  return {
    letterDrafting,
    letterBlocked,
    dismissLetterBlocked: () => setLetterBlocked(null),
    disclosureGenerating,
    supervisionGenerating,
    generating,
    error,
    draftLetter,
    saveLetter,
    generateDisclosure,
    generateSupervisionForm,
    downloadDocument,
    downloadLetterPdf,
    generatePackage,
  };
}
