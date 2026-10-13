/** The rules for a document uploaded into a sales package (the same ones whichever step it is uploaded from). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Only the Reason Why Letter may also be a Word file (the server converts it to PDF). */
export const allowsWord = (docKey) => docKey === "reasonWhyLetter";

/** The `accept` attribute for a document's file input. */
export const acceptFor = (docKey) => (allowsWord(docKey) ? "application/pdf,.pdf,.docx" : "application/pdf,.pdf");

/** The hint shown next to a document's upload control. */
export const sizeHint = (docKey) => (allowsWord(docKey) ? "PDF or Word (Max 10 MB)" : "PDF (Max 10 MB)");

/** A sentence saying why this file cannot be uploaded as document `label`, or null if it can. */
export function uploadProblem(docKey, label, file) {
  const lower = file.name.toLowerCase();
  const wordAllowed = allowsWord(docKey);
  if (!(lower.endsWith(".pdf") || (wordAllowed && lower.endsWith(".docx")))) {
    return wordAllowed ? `${label} must be a PDF or Word (.docx) file.` : `${label} must be a PDF file.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) return `${label} is larger than 10 MB.`;
  return null;
}

/** The toast after a successful upload. */
export const uploadedMessage = (docKey, label, file) =>
  allowsWord(docKey) && file.name.toLowerCase().endsWith(".docx") ? `${label} uploaded and converted to PDF` : `${label} uploaded`;
