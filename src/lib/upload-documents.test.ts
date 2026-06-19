import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  isExtractionResultsConflict,
  splitPdfFiles,
  uploadDocumentsSequential,
} from "./upload-documents";

describe("multi-document upload helpers", () => {
  it("keeps selected PDFs and reports rejected non-PDF files", () => {
    const pdf = new File(["%PDF"], "Millat - 2025.pdf", { type: "application/pdf" });
    const wrongType = new File(["text"], "notes.txt", { type: "text/plain" });
    const wrongExtension = new File(["data"], "workbook.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const result = splitPdfFiles([pdf, wrongType, wrongExtension]);

    expect(result.accepted).toEqual([pdf]);
    expect(result.rejected.map((file) => file.name)).toEqual(["notes.txt", "workbook.xlsx"]);
  });

  it("uploads PDFs sequentially and stops on the first failed file", async () => {
    const first = new File(["%PDF-1"], "Millat - 2024.pdf", { type: "application/pdf" });
    const second = new File(["%PDF-2"], "Millat - 2025.pdf", { type: "application/pdf" });
    const third = new File(["%PDF-3"], "Millat - 2026.pdf", { type: "application/pdf" });
    const upload = vi
      .fn()
      .mockResolvedValueOnce({ id: "doc-1", filename: first.name })
      .mockRejectedValueOnce(new Error("network failed"));

    const result = await uploadDocumentsSequential([first, second, third], upload);

    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload.mock.calls.map(([file]) => file.name)).toEqual([first.name, second.name]);
    expect(result.uploaded).toEqual([{ id: "doc-1", filename: first.name }]);
    expect(result.failed).toEqual({
      file: second,
      message: "network failed",
    });
  });

  it("detects the backend conflict for existing extraction results", () => {
    const error = new ApiError(
      409,
      "This project already has extraction results. Re-run with force=true to replace prior generated values.",
      null,
    );

    expect(isExtractionResultsConflict(error)).toBe(true);
    expect(
      isExtractionResultsConflict(
        new ApiError(409, "An extraction job is already queued or running.", null),
      ),
    ).toBe(false);
    expect(
      isExtractionResultsConflict(new Error("This project already has extraction results.")),
    ).toBe(false);
  });
});
