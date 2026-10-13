import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useToast } from "../../context/ToastContext";

/**
 * Uploads a file straight into a client's Drive folder (find-or-created the
 * same way the "Drive Folder" button does). If the client has an email on
 * file, they're notified automatically — see src.drive's email_client for
 * why that part is silent until real SMTP credentials are configured.
 */
export default function UploadClientFileButton({ clientId, clientName, clientEmail }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const { addToast } = useToast();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let picking the same file again re-trigger onChange
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadClientDriveFile(String(clientId), { displayName: clientName, clientEmail, file: file });
      addToast(clientEmail ? `Uploaded — ${clientName} was notified` : "Uploaded to Drive");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        addToast("Connect Google Drive on your Profile page first.");
      } else {
        addToast(err.message || "Could not upload the file");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-navy transition hover:bg-slate-50 disabled:opacity-60"
      >
        <Upload size={14} />
        {uploading ? "Uploading..." : "Upload File"}
      </button>
      <input ref={inputRef} type="file" className="hidden" onChange={handleFile} />
    </>
  );
}
