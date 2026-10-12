import { useRef, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { UPLOADED_DOCUMENTS, INVESTMENT_BEARING_TYPES } from "../lib/salesPackageOptions";
import { emptyData, emptyProduct } from "../lib/salesPackage/wizard";

const CHANGED_ELSEWHERE = "This package was changed elsewhere — showing the latest version. Re-apply your edits if needed.";

/**
 * The sales package draft: its form data, status and documents, and everything that keeps them in step with the server.
 *
 * Optimistic locking: the server's `version` of the package this wizard is based on is kept in `versionRef`, and every save
 * sends it, so a stale tab or device can never overwrite a newer save. When the server answers 409 with its newer copy,
 * `handleConflict` loads that copy instead (and says so); the advisor's unsaved edits are then re-applied by hand.
 * `saveDraft` and the Reason Why Letter save both go through it, and both advance the version on success.
 *
 *   const draft = useSalesPackageDraft({ packageId, catalog, onLoaded })
 *
 * `catalog` is useSalesPackageCatalog() (a loaded draft pre-fetches its products' dropdown lists); `onLoaded` runs after a
 * package has been loaded into the draft (the page resets to the first step).
 */
export default function useSalesPackageDraft({ packageId, catalog, onLoaded }) {
  const { addToast } = useToast();
  const [status, setStatus] = useState("draft");
  const [data, setData] = useState(emptyData());
  const [documents, setDocuments] = useState(UPLOADED_DOCUMENTS.map((d) => ({ ...d, uploaded: false })));
  // Bumping docVersion makes the Review step's inline previews refetch.
  const [docVersion, setDocVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  // The server version this wizard's data is based on; a save sends it so a stale tab can't overwrite a newer save.
  const versionRef = useRef(null);

  const patch = (fields) => setData((d) => ({ ...d, ...fields }));

  const applyDocuments = (docs) => {
    setDocuments(docs);
    setDocVersion((v) => v + 1);
  };

  /** Take what the server answered for the package: its version, status and documents. */
  const acceptServerPackage = (pkg) => {
    versionRef.current = pkg.version;
    setStatus(pkg.status);
    applyDocuments(pkg.documents);
  };

  const loadPackageInto = (pkg) => {
    versionRef.current = pkg.version;
    const products = pkg.data.products?.length ? pkg.data.products : [emptyProduct()];
    setStatus(pkg.status);
    setData({ ...emptyData(), ...pkg.data, products });
    applyDocuments(pkg.documents);
    onLoaded?.();
    // Pre-fetch each row's product/fund dropdown data — otherwise a
    // reopened draft shows blank "Select Product"/"Select fund" dropdowns
    // even though a selection is already saved, since those lists are
    // normally only fetched on the change handler, not on load.
    for (const p of products) {
      if (p.companyId) catalog.loadProductsFor(p.companyId);
      if (p.companyId && p.type && INVESTMENT_BEARING_TYPES.has(p.type)) catalog.loadFundsFor(p.companyId, p.type);
    }
  };

  /** A 409 carrying the server's newer package: show that version rather than overwrite it. True if it was one. */
  const handleConflict = (err) => {
    if (err.status === 409 && err.data?.package) {
      loadPackageInto(err.data.package);
      addToast(CHANGED_ELSEWHERE);
      return true;
    }
    return false;
  };

  const saveDraft = async ({ silent = false } = {}) => {
    if (!packageId) return;
    setSaving(true);
    try {
      const saved = await api.saveSalesPackageDraft(packageId, data, versionRef.current);
      versionRef.current = saved.version;
      if (!silent) addToast("Draft saved");
      return true;
    } catch (err) {
      if (!handleConflict(err)) addToast(err.message || "Could not save draft");
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    data,
    patch,
    status,
    setStatus,
    documents,
    docVersion,
    applyDocuments,
    saving,
    versionRef,
    acceptServerPackage,
    loadPackageInto,
    handleConflict,
    saveDraft,
  };
}
