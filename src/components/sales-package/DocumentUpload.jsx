import { acceptFor } from "../../lib/salesPackage/uploads";

/** A thin progress bar for an upload in flight. `percent` of undefined / null shows nothing. */
export function UploadProgressBar({ percent }) {
  if (percent === undefined || percent === null) return null;
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
}

/**
 * The file chooser for one document of the package. Whichever step shows it (Documents, or Review's "Replace file"), it
 * accepts the same file types and hands the chosen file to `onUpload(doc.key, doc.label, file)`, which validates and uploads
 * it (see useDocumentUploads). The children are what the clickable label looks like.
 */
export function DocumentFileInput({ doc, onUpload, className = "", children }) {
  return (
    <label className={className}>
      {children}
      <input
        type="file"
        accept={acceptFor(doc.key)}
        className="hidden"
        onChange={(e) => onUpload(doc.key, doc.label, e.target.files?.[0])}
      />
    </label>
  );
}
