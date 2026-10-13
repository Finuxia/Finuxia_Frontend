import { useState } from "react";
import { Download, Save, Sparkles } from "lucide-react";
import { StepCard } from "./shared";
import AiBlockedNotice from "../AiBlockedNotice";
import AiUsageInline from "../AiUsageInline";

function LetterPreview({ text }) {
  const rawLines = (text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (rawLines.length === 0) {
    return <p className="text-sm text-slate-400">Click "Generate Draft" below to draft the letter.</p>;
  }
  // Group into blocks: a line with "____" blanks separated by 3+ spaces is a
  // row of side-by-side columns (signature / date lines) and must render as
  // a grid — HTML collapses the spaces, which runs the halves together.
  const blocks = [];
  let seenTitle = false;
  for (const line of rawLines) {
    const bold = /^\*\*(.+)\*\*$/.exec(line);
    if (bold) {
      blocks.push({ type: seenTitle ? "heading" : "title", text: bold[1] });
      seenTitle = true;
      continue;
    }
    const cells = line.split(/\s{3,}/);
    if (cells.length >= 2 && line.includes("____")) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === "columns") last.rows.push(cells);
      else blocks.push({ type: "columns", rows: [cells] });
      continue;
    }
    blocks.push({ type: "para", text: line });
  }
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((b, i) => {
        if (b.type === "title")
          return (
            <p key={i} className="text-lg font-bold text-navy">
              {b.text}
            </p>
          );
        if (b.type === "heading")
          return (
            <p key={i} className="mt-1 font-semibold text-navy">
              {b.text}
            </p>
          );
        if (b.type === "columns") {
          return (
            <div key={i} className="mt-4 grid grid-cols-1 gap-x-8 gap-y-5 text-sm text-slate-700 sm:grid-cols-2">
              {b.rows.flatMap((row, r) =>
                row.map((cell, c) => (
                  <p key={`${r}-${c}`} className="break-words">
                    {cell}
                  </p>
                ))
              )}
            </div>
          );
        }
        return (
          <p key={i} className="text-sm leading-relaxed text-slate-700">
            {b.text}
          </p>
        );
      })}
    </div>
  );
}

export default function LetterStep({
  data,
  patch,
  letterDoc,
  onDownload,
  onDownloadLetterPdf,
  onDraftLetter,
  letterDrafting,
  aiUsage,
  letterBlocked,
  onDismissBlocked,
  onSaveLetter,
}) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <StepCard
        title="Reason Why Letter"
        subtitle="Must be generated and reviewed before moving on. The Agent Disclosure and Supervision forms are handled later, on the Documents step."
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onDraftLetter}
            disabled={letterDrafting}
            className="flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light disabled:opacity-60"
          >
            <Sparkles size={15} />
            {letterDrafting ? "Drafting..." : data.reasonWhyLetterText ? "Regenerate Draft" : "Generate Draft"}
          </button>
          {data.reasonWhyLetterText && (
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-navy transition hover:bg-slate-50"
            >
              {editing ? "Preview" : "Edit text"}
            </button>
          )}
        </div>

        <AiUsageInline usage={aiUsage} className="mb-3" />
        {letterBlocked && (
          <AiBlockedNotice className="mb-3" message={letterBlocked.message} actions={letterBlocked.data?.actions} onDismiss={onDismissBlocked} />
        )}

        {editing ? (
          <textarea
            rows={16}
            value={data.reasonWhyLetterText}
            onChange={(e) => patch({ reasonWhyLetterText: e.target.value })}
            placeholder={'Click "Generate Draft" above, then review/edit the letter here before saving.'}
            className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
          />
        ) : (
          <div className="max-h-[600px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-5">
            <LetterPreview text={data.reasonWhyLetterText} />
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSaveLetter}
            disabled={!data.reasonWhyLetterText.trim()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-navy transition hover:bg-slate-50 disabled:opacity-40"
          >
            <Save size={14} />
            Save Letter
          </button>
          {letterDoc?.generatedFileName && (
            <button
              type="button"
              onClick={() => onDownload(letterDoc.key, "Reason Why Letter", true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-navy transition hover:bg-slate-50"
            >
              <Download size={14} />
              Download Word (.docx)
            </button>
          )}
          {letterDoc?.generatedFileName && (
            <button
              type="button"
              onClick={onDownloadLetterPdf}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-navy transition hover:bg-slate-50"
            >
              <Download size={14} />
              Download PDF
            </button>
          )}
        </div>
      </StepCard>
    </>
  );
}
