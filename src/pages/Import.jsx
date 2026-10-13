import { useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet, CheckCircle2, XCircle, Download } from "lucide-react";
import { useClients } from "../context/ClientsContext";
import { useToast } from "../context/ToastContext";
import { TEMPLATE_COLUMNS, TEMPLATE_SAMPLE } from "../lib/clientImport";
import { buildTemplateWorkbook, downloadWorkbook, readSpreadsheetFile, SpreadsheetError } from "../lib/spreadsheet";

export default function Import() {
  const { importClients } = useClients();
  const { addToast } = useToast();
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);

  const handleDownloadTemplate = async () => {
    try {
      const workbook = await buildTemplateWorkbook(TEMPLATE_COLUMNS, TEMPLATE_SAMPLE);
      await downloadWorkbook(workbook, "advisorpilot-import-template.xlsx");
      addToast("Template downloaded");
    } catch {
      addToast("Could not create the template");
    }
  };
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState(null);
  const [result, setResult] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setParseError("");
    setParsing(true);
    try {
      const rows = await readSpreadsheetFile(file);
      setParsedRows(rows);
    } catch (err) {
      setParseError(
        err instanceof SpreadsheetError ? err.message : "Could not read this file. Make sure it's a valid .xlsx or .csv export."
      );
      setParsedRows(null);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!parsedRows || importing) return;
    setImporting(true);
    try {
      const res = await importClients(parsedRows);
      setResult(res);
      if (res.successCount > 0) addToast(`Imported ${res.successCount} client${res.successCount === 1 ? "" : "s"}`);
    } catch (err) {
      addToast(err.message || "Couldn't import the clients — nothing was saved");
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFileName("");
    setParsedRows(null);
    setResult(null);
    setParseError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Import Clients</h1>
          <p className="text-sm text-slate-500">Upload a spreadsheet to bring your existing pipeline into Finuxia.</p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-navy shadow-sm transition hover:bg-slate-50"
        >
          <Download size={14} />
          Download Template
        </button>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="mb-4 text-sm text-slate-500">
          Expected columns:{" "}
          <span className="font-medium text-navy">
            Name, Phone, Email, Telegram, Referred By, Stage, Last Contact, Next Follow-up
          </span>
          . Only <span className="font-medium text-navy">Name</span> is required.
        </p>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-6 py-10 text-center transition hover:border-gold hover:bg-gold/5">
          <UploadCloud size={28} className="text-slate-400" />
          <span className="text-sm font-semibold text-navy">
            {fileName || "Click to choose a .xlsx or .csv file"}
          </span>
          <span className="text-xs text-slate-400">or drag and drop</span>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>

        {parsing && <p className="mt-3 text-sm text-slate-500">Reading file...</p>}
        {parseError && <p className="mt-3 text-sm text-av-red">{parseError}</p>}

        {parsedRows && !result && (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-navy">
              <FileSpreadsheet size={16} className="text-gold-dark" />
              {parsedRows.length} row{parsedRows.length === 1 ? "" : "s"} detected in {fileName}
            </div>
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="rounded-lg bg-navy px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-light disabled:opacity-60"
              >
                {importing ? "Importing…" : "Import"}
              </button>
            </div>
          </div>
        )}
      </section>

      {result && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-av-green/10 p-4">
              <div className="flex items-center gap-2 text-av-green">
                <CheckCircle2 size={16} />
                <span className="text-xs font-semibold uppercase tracking-wide">Success</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-navy">{result.successCount}</p>
            </div>
            <div className="rounded-xl bg-av-red/10 p-4">
              <div className="flex items-center gap-2 text-av-red">
                <XCircle size={16} />
                <span className="text-xs font-semibold uppercase tracking-wide">Failed</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-navy">{result.failedRows.length}</p>
            </div>
          </div>

          {result.failedRows.length > 0 && (
            <div className="mt-4 flex flex-col gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Errors</p>
              {result.failedRows.map((f, i) => (
                <p key={i} className="text-sm text-slate-600">
                  Row {f.row}: {f.error}
                </p>
              ))}
            </div>
          )}

          <button
            onClick={reset}
            className="mt-5 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-light"
          >
            Import Another File
          </button>
        </section>
      )}
    </div>
  );
}
