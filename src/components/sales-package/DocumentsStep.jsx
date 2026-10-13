import { sizeHint } from "../../lib/salesPackage/uploads";
import { Upload, Download, CheckCircle2, FileCheck2 } from "lucide-react";
import { StepCard } from "./shared";
import { DocumentFileInput, UploadProgressBar } from "./DocumentUpload";

function GeneratedDocCard({ label, subtitle, doc, onDownload, onDownloadPdf, onGenerate, generating }) {
  return (
    <div className="rounded-xl border border-gold/40 bg-gold/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-navy">{label}</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {doc?.generatedFileName && (
            <button
              type="button"
              onClick={() => onDownload(doc.key, label, true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy transition hover:bg-slate-50"
            >
              <Download size={13} />
              {doc.generatedFileName.endsWith(".docx") ? "Download Word" : "Download"}
            </button>
          )}
          {doc?.generatedFileName && onDownloadPdf && (
            <button
              type="button"
              onClick={onDownloadPdf}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy transition hover:bg-slate-50"
            >
              <Download size={13} />
              Download PDF
            </button>
          )}
          {onGenerate && (
            <button
              type="button"
              onClick={onGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-light disabled:opacity-60"
            >
              <FileCheck2 size={13} />
              {generating ? "Generating..." : doc?.generatedFileName ? "Regenerate" : "Generate for Me"}
            </button>
          )}
        </div>
      </div>
      {doc?.generatedFileName ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-av-green">
          <CheckCircle2 size={13} />
          Ready to download — {doc.generatedFileName}
        </p>
      ) : (
        !onGenerate && <p className="mt-2 text-xs text-slate-400">Not generated yet.</p>
      )}
    </div>
  );
}

export default function DocumentsStep({
  documents,
  uploadProgress,
  onUpload,
  onDownload,
  onDownloadLetterPdf,
  onGenerateDisclosure,
  disclosureGenerating,
  onGenerateSupervisionForm,
  supervisionGenerating,
}) {
  const disclosureDoc = documents.find((d) => d.key === "agentDisclosureForm");
  const letterDoc = documents.find((d) => d.key === "reasonWhyLetter");
  const supervisionDoc = documents.find((d) => d.key === "supervisionForm");

  return (
    <>
      <StepCard
        title="Documents We Prepare For You"
        subtitle="Generate and download these, complete or sign them as needed, then upload the final versions in the next section."
      >
        <div className="flex flex-col gap-2.5">
          <GeneratedDocCard
            label="Reason Why Letter"
            subtitle="From the letter you reviewed and saved on the Reason Why Letter step — go back there to change it."
            doc={letterDoc}
            onDownload={onDownload}
            onDownloadPdf={onDownloadLetterPdf}
          />
          <GeneratedDocCard
            label="Agent Disclosure Form"
            subtitle="From your Compliance Profile (Profile → Compliance) plus this client's name."
            doc={disclosureDoc}
            onDownload={onDownload}
            onGenerate={onGenerateDisclosure}
            generating={disclosureGenerating}
          />
          <GeneratedDocCard
            label="Supervision Form"
            subtitle="From this package's products/needs, your Compliance Profile's supervisor, and the Compliance step's answers."
            doc={supervisionDoc}
            onDownload={onDownload}
            onGenerate={onGenerateSupervisionForm}
            generating={supervisionGenerating}
          />
        </div>
      </StepCard>

      <StepCard
        title="Upload Documents"
        subtitle={`Upload all ${documents.length} documents to create the final package — including the three above, in their final form.`}
      >
        <div className="flex flex-col gap-2.5">
          {documents.map((d, i) => (
            <div key={d.key} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy/5 text-xs font-bold text-navy">
                  {i + 1}
                </div>
                <span className="w-full shrink-0 text-sm font-medium text-navy sm:w-48">{d.label} *</span>
                <DocumentFileInput
                  doc={d}
                  onUpload={onUpload}
                  className="flex min-w-[200px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500 transition hover:border-gold hover:bg-gold/5"
                >
                  {d.uploaded ? (
                    <span className="flex items-center gap-1.5 text-navy">
                      <CheckCircle2 size={14} className="text-av-green" />
                      {d.fileName || "Uploaded"}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Upload size={13} />
                      Choose file
                    </span>
                  )}
                </DocumentFileInput>
                <span className="shrink-0 text-xs text-slate-400">{sizeHint(d.key)}</span>
              </div>
              <UploadProgressBar percent={uploadProgress[d.key]} />
            </div>
          ))}
        </div>
      </StepCard>
    </>
  );
}
