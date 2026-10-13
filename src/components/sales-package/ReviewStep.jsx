import { useEffect, useState } from "react";
import { Upload, Download, Package, AlertTriangle, ExternalLink } from "lucide-react";
import { api } from "../../lib/api";
import { StepCard, SummaryRow } from "./shared";
import { DocumentFileInput, UploadProgressBar } from "./DocumentUpload";

function DocReviewCard({ packageId, doc, version, progress, onUpload, onDownload }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!doc.uploaded) {
      setUrl(null);
      return undefined;
    }
    let cancelled = false;
    let created = null;
    setFailed(false);
    api
      .previewSalesPackageDocument(packageId, doc.key)
      .then((u) => {
        if (cancelled) URL.revokeObjectURL(u);
        else {
          created = u;
          setUrl(u);
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [packageId, doc.key, doc.uploaded, version]);

  return (
    <div className="rounded-xl border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-navy">{doc.label}</p>
          <p className="truncate text-xs text-slate-400">{doc.uploaded ? doc.fileName : "Missing — go back and add it"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {doc.uploaded && (
            <button
              type="button"
              onClick={() => onDownload(doc.key, doc.label)}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50"
            >
              <Download size={12} />
              Download
            </button>
          )}
          <DocumentFileInput
            doc={doc}
            onUpload={onUpload}
            className="flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50"
          >
            <Upload size={12} />
            Replace file
          </DocumentFileInput>
        </div>
      </div>
      {progress !== undefined && progress !== null && (
        <div className="px-4 pt-2">
          <UploadProgressBar percent={progress} />
        </div>
      )}
      {doc.uploaded &&
        (failed ? (
          <p className="px-4 py-6 text-center text-xs text-av-red">Couldn't load the preview — you can still download it.</p>
        ) : url ? (
          <iframe title={doc.label} src={url} className="h-[560px] w-full rounded-b-xl" />
        ) : (
          <p className="px-4 py-6 text-center text-xs text-slate-400">Loading preview...</p>
        ))}
    </div>
  );
}

export default function ReviewStep({
  data,
  packageId,
  docVersion,
  uploadProgress,
  advisorName,
  documents,
  onUpload,
  onDownload,
  confirmChecked,
  setConfirmChecked,
  onGenerate,
  generating,
  error,
  status,
}) {
  const missingDocs = documents.filter((d) => !d.uploaded);
  const blockers = [
    !data.policyOwner && "Policy Owner is missing (Client step)",
    !data.insuredPerson && "Insured Person is missing (Client step)",
    data.products.length === 0 && "No products added (Products step)",
    ...missingDocs.map((d) => `${d.label} hasn't been uploaded yet (Documents step)`),
    !confirmChecked && "Check the confirmation box below",
  ].filter(Boolean);
  const canGenerate = blockers.length === 0;

  return (
    <>
      <StepCard
        title="Review & Generate"
        subtitle="Check everything below — every uploaded document is shown as it will appear in the package."
      >
        <div className="flex flex-col gap-4 text-sm">
          <SummaryRow label="Advisor">{advisorName || "—"}</SummaryRow>
          <SummaryRow label="Policy Owner">{data.policyOwner || "—"}</SummaryRow>
          <SummaryRow label="Insured Person">{data.insuredPerson || "—"}</SummaryRow>
          <SummaryRow label="Dependants">
            {data.dependants.filter((d) => d.fullName).length
              ? data.dependants
                  .map((d) => d.fullName)
                  .filter(Boolean)
                  .join(", ")
              : "None"}
          </SummaryRow>
          <SummaryRow label="Needs">{data.needs.length ? data.needs.join(", ") : "None selected"}</SummaryRow>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Products</p>
            {data.products.filter((p) => p.productName).length === 0 ? (
              <p className="text-slate-400">No products added.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {data.products
                  .filter((p) => p.productName)
                  .map((p) => (
                    <li key={p.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      <span className="font-medium text-navy">
                        {p.company} — {p.productName || "(not selected)"}
                        {p.accountType ? ` (${p.accountType})` : ""}
                      </span>
                      <span className="text-slate-500">
                        {" "}
                        · {p.coverageAmount || "—"} · {p.premium || "—"} {p.frequency}
                      </span>
                      {p.allocations.length > 0 && (
                        <div className="mt-1 text-xs text-slate-500">
                          {p.allocations.map((a) => `${a.fundName} (${a.allocationPct}%)`).join(", ")}
                        </div>
                      )}
                    </li>
                  ))}
              </ul>
            )}
          </div>
          <SummaryRow label="Documents">
            {documents.filter((d) => d.uploaded).length} / {documents.length} ready
          </SummaryRow>
        </div>
      </StepCard>

      <StepCard
        title="Documents"
        subtitle="These are the files you uploaded — scroll through each. To change one, use Replace file. Nothing is sent anywhere."
      >
        <div className="flex flex-col gap-4">
          {documents.map((doc) => (
            <DocReviewCard
              key={doc.key}
              packageId={packageId}
              doc={doc}
              version={docVersion}
              progress={uploadProgress[doc.key]}
              onUpload={onUpload}
              onDownload={onDownload}
            />
          ))}
        </div>
      </StepCard>

      <StepCard title="Generate" subtitle="Confirm and create the final package.">
        {error && <p className="mb-3 text-xs text-av-red">{error}</p>}

        <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-navy">
          <input
            type="checkbox"
            checked={confirmChecked}
            onChange={(e) => setConfirmChecked(e.target.checked)}
            className="mt-0.5 accent-gold"
          />
          I have reviewed the information above and confirm that it accurately reflects the client's circumstances, needs and
          recommendations.
        </label>

        {blockers.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
              <AlertTriangle size={13} />
              Not ready to generate yet:
            </p>
            <ul className="ml-1 list-disc pl-4 text-xs text-amber-700">
              {blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || generating}
          className="mt-4 flex items-center gap-1.5 rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light disabled:opacity-50"
        >
          {generating ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <Package size={15} />
          )}
          {generating ? "Generating..." : status === "completed" ? "Regenerate Package" : "Generate Package"}
        </button>

        {status === "completed" && (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <p className="mb-2 text-sm font-semibold text-navy">Send for signature</p>
            <p className="mb-3 text-xs text-slate-500">
              Download the generated package above, then upload it into DocuSeal to add signature/date fields and send it to the client.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="https://docuseal.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light"
              >
                <ExternalLink size={14} />
                Open DocuSeal
              </a>
            </div>
          </div>
        )}
      </StepCard>
    </>
  );
}
