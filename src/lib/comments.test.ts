import { describe, expect, it } from "vitest";
import type { ReviewCommentResponse, TeamMember } from "./api/types";
import {
  activeMentionQuery,
  buildCellCommentIndicators,
  cellSelectionFromComment,
  commentsForCell,
  commentsForSheet,
  insertMention,
  filterMentionMembers,
  mentionCandidates,
  normalizeCommentThreads,
} from "./comments";

const team: TeamMember[] = [
  { name: "Ayesha Shah", email: "ayesha@example.com", role: "Analyst", canRemove: true },
  { name: "Omar Riaz", email: "omar@example.com", role: "Manager", canRemove: true },
];

const comments: ReviewCommentResponse[] = [
  comment({ id: "comment-1", fieldId: "field-a1", sheetName: "Inputs", templateCell: "A1", body: "Check @Ayesha", createdAt: "2026-06-02T10:00:01Z" }),
  comment({ id: "reply-1", parentCommentId: "comment-1", sheetName: "Inputs", templateCell: "A1", body: "Reply", createdAt: "2026-06-02T10:00:02Z" }),
  comment({ id: "comment-2", sheetName: "Inputs", templateCell: "Inputs!B2", body: "Other cell", status: "resolved", createdAt: "2026-06-02T10:00:03Z" }),
  comment({ id: "comment-3", sheetName: "Output", templateCell: "A1", body: "Different sheet", createdAt: "2026-06-02T10:00:04Z" }),
];

describe("comment helpers", () => {
  it("detects the active @ mention query and inserts the selected user", () => {
    expect(activeMentionQuery("@", 1)).toEqual({ start: 0, end: 1, query: "" });
    expect(activeMentionQuery("Please ask @Aye", 15)).toEqual({ start: 11, end: 15, query: "Aye" });
    expect(insertMention("Please ask @Aye", { start: 11, end: 15, query: "Aye" }, team[0])).toBe(
      "Please ask @AyeshaShah ",
    );
  });

  it("shows all mentionable users and excludes the current user", () => {
    const candidates = mentionCandidates(team, { name: "Ayesha Shah", email: "ayesha@example.com" });

    expect(candidates).toEqual([
      expect.objectContaining({ name: "Omar Riaz", email: "omar@example.com" }),
    ]);
    expect(filterMentionMembers(candidates, "ayesha")).toEqual(candidates);
  });

  it("normalizes flat comments into one-level threads", () => {
    const threads = normalizeCommentThreads(comments);

    expect(threads).toHaveLength(3);
    expect(threads[0].id).toBe("comment-3");
    expect(threads.find((thread) => thread.id === "comment-1")?.replies).toHaveLength(1);
  });

  it("filters comments by selected cell and active sheet", () => {
    expect(commentsForCell(comments, { fieldId: "field-a1", sheetName: "Inputs", templateCell: "A1" })).toHaveLength(2);
    expect(commentsForCell(comments, { sheetName: "Inputs", templateCell: "B2" })).toHaveLength(1);
    expect(commentsForSheet(comments, "Inputs").map((comment) => comment.id)).toEqual([
      "comment-2",
      "reply-1",
      "comment-1",
    ]);
  });

  it("builds open-comment indicators and resolves comment targets back to cells", () => {
    const indicators = buildCellCommentIndicators(comments);

    expect(indicators.has("Inputs!A1")).toBe(true);
    expect(indicators.has("Inputs!B2")).toBe(false);
    expect(cellSelectionFromComment(comments[0], "sheet-1")).toEqual({ sheetId: "sheet-1", row: 0, col: 0 });
  });
});

function comment(input: Partial<ReviewCommentResponse> & { id: string }): ReviewCommentResponse {
  return {
    id: input.id,
    projectId: "project-1",
    parentCommentId: input.parentCommentId ?? null,
    fieldId: input.fieldId ?? null,
    templateCell: input.templateCell ?? null,
    sheetName: input.sheetName ?? null,
    actor: "user-1",
    body: input.body ?? "Body",
    mentions: { resolved: [], unresolved: [] },
    status: input.status ?? "open",
    replyCount: 0,
    replies: [],
    createdAt: input.createdAt ?? `2026-06-02T10:00:0${input.id.at(-1) ?? "0"}Z`,
    updatedAt: null,
    editedAt: null,
    resolvedAt: null,
    resolvedBy: null,
  };
}
