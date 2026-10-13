import { useState } from "react";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { uploadProblem, uploadedMessage } from "../lib/salesPackage/uploads";

/**
 * Uploading the package's documents, from wherever the file chooser is shown: checks the file (PDF, or Word for the letter;
 * at most 10 MB), uploads it with progress, and hands the package's updated documents back through `applyDocuments`.
 *
 *   const { uploadProgress, uploadDocument } = useDocumentUploads({ packageId, applyDocuments });
 *   <DocumentFileInput onUpload={uploadDocument} .../>
 */
export default function useDocumentUploads({ packageId, applyDocuments }) {
  const { addToast } = useToast();
  const [uploadProgress, setUploadProgress] = useState({});

  const uploadDocument = async (key, label, file) => {
    if (!file) return;
    const problem = uploadProblem(key, label, file);
    if (problem) {
      addToast(problem);
      return;
    }
    setUploadProgress((p) => ({ ...p, [key]: 0 }));
    try {
      const pkg = await api.uploadSalesPackageDocument(packageId, key, file, (pct) => setUploadProgress((p) => ({ ...p, [key]: pct })));
      applyDocuments(pkg.documents);
      addToast(uploadedMessage(key, label, file));
    } catch (err) {
      addToast(err.message || `Could not upload ${label}`);
    } finally {
      setUploadProgress((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    }
  };

  return { uploadProgress, uploadDocument };
}
