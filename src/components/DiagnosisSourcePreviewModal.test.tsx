import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DiagnosisSourceInlinePreview,
  DiagnosisSourcePreviewModal,
} from "./DiagnosisSourcePreviewModal";

vi.mock("@/lib/api/projects", () => ({
  readDocumentPageImage: vi.fn(() => Promise.resolve(new Blob(["png"], { type: "image/png" }))),
}));

const createObjectURL = vi.fn(() => "blob:preview");
const revokeObjectURL = vi.fn();

beforeEach(() => {
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });
});

afterEach(() => {
  cleanup();
});

describe("DiagnosisSourcePreviewModal", () => {
  it("shows the source preview inline without requiring an open-preview click", async () => {
    const onExpand = vi.fn();
    render(
      <DiagnosisSourceInlinePreview
        onExpand={onExpand}
        source={{
          projectId: "project-1",
          documentId: "doc-1",
          documentFilename: "Millat 2025.pdf",
          pdfPageIndex: 9,
          printedPageNumber: 42,
          label: "Revenue",
          value: "10,000",
          confidence: 91,
          sourceText: "Revenue row",
          boundingBox: [12, 40, 76, 5],
        }}
      />,
    );

    expect(screen.getByText("Source preview")).not.toBeNull();
    expect((await screen.findByAltText("Millat 2025.pdf page 42")).getAttribute("src")).toBe(
      "blob:preview",
    );
    expect(screen.queryByRole("button", { name: "Open preview" })).toBeNull();
    expect(screen.getByLabelText("Highlighted source row").style.border).toBe(
      "2px solid rgb(220, 38, 38)",
    );
  });

  it("renders page image controls and a red source row highlight", async () => {
    render(
      <DiagnosisSourcePreviewModal
        open
        onOpenChange={() => undefined}
        source={{
          projectId: "project-1",
          documentId: "doc-1",
          documentFilename: "Millat 2025.pdf",
          pdfPageIndex: 9,
          printedPageNumber: 42,
          label: "Revenue",
          value: "10,000",
          confidence: 91,
          sourceText: "Revenue row",
          boundingBox: [12, 40, 76, 5],
        }}
      />,
    );

    expect((await screen.findByAltText("Millat 2025.pdf page 42")).getAttribute("src")).toBe(
      "blob:preview",
    );
    expect(screen.getByRole("button", { name: "Zoom in" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "Zoom out" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "Reset zoom" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "Fit page" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByLabelText("Highlighted source row").style.border).toBe(
      "2px solid rgb(220, 38, 38)",
    );
  });

  it("renders backend normalized object bounding boxes as red source row highlights", async () => {
    render(
      <DiagnosisSourcePreviewModal
        open
        onOpenChange={() => undefined}
        source={{
          projectId: "project-1",
          documentId: "doc-1",
          documentFilename: "Millat 2025.pdf",
          pdfPageIndex: 9,
          printedPageNumber: 42,
          label: "Revenue",
          value: "10,000",
          confidence: 91,
          sourceText: "Revenue row",
          boundingBox: { x: 0.12, y: 0.4, width: 0.76, height: 0.05 },
        }}
      />,
    );

    await screen.findByAltText("Millat 2025.pdf page 42");
    const highlight = screen.getByLabelText("Highlighted source row");
    expect(highlight.style.left).toBe("11.2%");
    expect(highlight.style.top).toBe("38.8%");
    expect(highlight.style.width).toBe("77.6%");
    expect(highlight.style.height).toBe("7.4%");
    expect(highlight.style.borderRadius).toBe("6px");
  });

  it("updates zoom controls and reports when source row location is unavailable", async () => {
    const user = userEvent.setup();
    render(
      <DiagnosisSourcePreviewModal
        open
        onOpenChange={() => undefined}
        source={{
          projectId: "project-1",
          documentId: "doc-1",
          documentFilename: "Millat 2025.pdf",
          pdfPageIndex: 9,
          printedPageNumber: 42,
          label: "Revenue",
          value: "10,000",
          confidence: 91,
          sourceText: "Revenue row",
          boundingBox: null,
        }}
      />,
    );

    await screen.findByAltText("Millat 2025.pdf page 42");
    expect(screen.getByText("Source row location unavailable")).not.toBeNull();
    expect(screen.getByTestId("source-page-scale").style.transform).toBe("scale(1)");

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByTestId("source-page-scale").style.transform).toBe("scale(1.25)");

    await user.click(screen.getByRole("button", { name: "Reset zoom" }));
    await waitFor(() => {
      expect(screen.getByTestId("source-page-scale").style.transform).toBe("scale(1)");
    });
  });
});
