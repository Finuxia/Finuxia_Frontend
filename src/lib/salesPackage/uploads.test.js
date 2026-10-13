import { describe, expect, it } from "vitest";
import {
  acceptFor,
  allowsWord,
  MAX_UPLOAD_BYTES,
  sizeHint,
  uploadedMessage,
  uploadProblem,
} from "./uploads";

const file = (name, size = 10) => ({ name, size });

describe("which files may be uploaded", () => {
  it("a PDF may, whatever the case", () => {
    expect(uploadProblem("fna", "FNA", file("a.pdf"))).toBeNull();
    expect(uploadProblem("fna", "FNA", file("A.PDF"))).toBeNull();
  });

  it("it must END in .pdf: a name that only contains it is refused", () => {
    expect(uploadProblem("fna", "FNA", file("a.pdf.exe"))).toBe(
      "FNA must be a PDF file.",
    );
    expect(uploadProblem("fna", "FNA", file("a.pdfx"))).toBe(
      "FNA must be a PDF file.",
    );
    expect(uploadProblem("fna", "FNA", file("pdf"))).toBe(
      "FNA must be a PDF file.",
    );
  });

  it("only the Reason Why Letter may be a Word file, and only a .docx", () => {
    expect(allowsWord("reasonWhyLetter")).toBe(true);
    expect(allowsWord("fna")).toBe(false);
    expect(
      uploadProblem("reasonWhyLetter", "Letter", file("l.docx")),
    ).toBeNull();
    expect(uploadProblem("reasonWhyLetter", "Letter", file("l.doc"))).toBe(
      "Letter must be a PDF or Word (.docx) file.",
    );
    expect(uploadProblem("fna", "FNA", file("l.docx"))).toBe(
      "FNA must be a PDF file.",
    );
  });

  it("10 MB is allowed and one byte more is not", () => {
    expect(MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
    expect(
      uploadProblem("fna", "FNA", file("a.pdf", MAX_UPLOAD_BYTES)),
    ).toBeNull();
    expect(
      uploadProblem("fna", "FNA", file("a.pdf", MAX_UPLOAD_BYTES + 1)),
    ).toBe("FNA is larger than 10 MB.");
  });

  it("the file chooser and its hint say the same thing", () => {
    expect(acceptFor("fna")).toBe("application/pdf,.pdf");
    expect(acceptFor("reasonWhyLetter")).toBe("application/pdf,.pdf,.docx");
    expect(sizeHint("fna")).toBe("PDF (Max 10 MB)");
    expect(sizeHint("reasonWhyLetter")).toBe("PDF or Word (Max 10 MB)");
  });

  it("a Word letter says it was converted", () => {
    expect(uploadedMessage("reasonWhyLetter", "Letter", file("l.DOCX"))).toBe(
      "Letter uploaded and converted to PDF",
    );
    expect(uploadedMessage("reasonWhyLetter", "Letter", file("l.pdf"))).toBe(
      "Letter uploaded",
    );
    expect(uploadedMessage("fna", "FNA", file("a.pdf"))).toBe("FNA uploaded");
  });
});
