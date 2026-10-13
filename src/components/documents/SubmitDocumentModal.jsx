import { useRef, useState } from "react";
import { X, UploadCloud, Sparkles, FileText, XCircle } from "lucide-react";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";

/**
 * Submit a client document for the shared Documents page. The advisor picks
 * a PDF, can optionally have AI suggest a topic/summary/keywords from its
 * content, edits any of it, then submits — it stays hidden from everyone
 * else until an admin approves it in /admin.
 */
export default function SubmitDocumentModal({ onClose, onSubmitted }) {
  const { addToast } = useToast();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handlePickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== "application/pdf") {
      addToast("Please choose a PDF file.");
      return;
    }
    setFile(f);
  };

  const handleSuggest = async () => {
    if (!file) return;
    setSuggesting(true);
    setError("");
    try {
      const suggestion = await api.suggestDocument(file);
      setTitle(suggestion.topic || "");
      setSummary(suggestion.summary || "");
      setKeywords(suggestion.keywords || []);
      addToast("AI suggestion applied — review and edit before submitting.");
    } catch (err) {
      addToast(err.message || "Could not generate an AI suggestion. You can still fill this in yourself.");
    } finally {
      setSuggesting(false);
    }
  };

  const addKeyword = () => {
    const value = keywordInput.trim();
    if (!value || keywords.includes(value)) {
      setKeywordInput("");
      return;
    }
    setKeywords((prev) => [...prev, value]);
    setKeywordInput("");
  };

  const removeKeyword = (value) => {
    setKeywords((prev) => prev.filter((k) => k !== value));
  };

  const handleKeywordKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Choose a PDF file first.");
      return;
    }
    if (!title.trim() || !summary.trim()) {
      setError("Topic and summary are both required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.submitDocument({ title, summary, keywords, file });
      addToast("Submitted — an admin will review it before it appears for everyone.");
      onSubmitted?.();
      onClose();
    } catch (err) {
      setError(err.message || "Could not submit this document.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy/50 p-0 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="presentation"
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl animate-slide-up sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-navy">Submit a Document</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Submitted documents are only visible to you until an admin approves them.
          </p>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">PDF File</span>
            {file ? (
              <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5">
                <FileText size={16} className="shrink-0 text-gold-dark" />
                <span className="min-w-0 flex-1 truncate text-sm text-navy">{file.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  aria-label="Remove file"
                  className="shrink-0 text-slate-400 hover:text-av-red"
                >
                  <XCircle size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500 transition hover:border-gold hover:text-gold-dark"
              >
                <UploadCloud size={16} />
                Choose a PDF...
              </button>
            )}
            <input ref={fileRef} type="file" accept="application/pdf" onChange={handlePickFile} className="hidden" />
          </div>

          <button
            type="button"
            onClick={handleSuggest}
            disabled={!file || suggesting}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm font-semibold text-gold-dark transition hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles size={14} />
            {suggesting ? "Reading document..." : "Suggest topic, summary & keywords with AI"}
          </button>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Topic</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="A short, specific title..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Summary</span>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              placeholder="What does this document cover, and who is it for?"
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Keywords</span>
            <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2">
              {keywords.map((k) => (
                <span key={k} className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-navy">
                  {k}
                  <button
                    type="button"
                    onClick={() => removeKeyword(k)}
                    aria-label={`Remove ${k}`}
                    className="text-slate-400 hover:text-av-red"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              <input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeywordKeyDown}
                onBlur={addKeyword}
                placeholder={keywords.length ? "" : "Type a keyword, press Enter..."}
                className="min-w-[8rem] flex-1 border-0 py-1 text-sm text-navy outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          {error && <p className="text-xs text-av-red">{error}</p>}

          <div className="mt-1 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit for Review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
