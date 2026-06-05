import type { ReviewCommentResponse, TeamMember } from "@/lib/api/types";

export type CommentThread = ReviewCommentResponse & { replies: ReviewCommentResponse[] };
export type CommentTarget = {
  fieldId?: string | null;
  sheetName?: string | null;
  templateCell?: string | null;
};
export type CellCommentIndicator = {
  count: number;
  displayCount: string;
};
export type MentionQuery = { start: number; end: number; query: string };
export type CellSelection = { sheetId: string; row: number; col: number };
export type MentionUser = Pick<TeamMember, "name" | "email"> & Partial<TeamMember>;

const MENTION_TOKEN_RE = /@([A-Za-z0-9._%+-]*)$/;
const CELL_RE = /^([A-Za-z]+)(\d+)$/;

export function activeMentionQuery(value: string, cursor: number): MentionQuery | null {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(MENTION_TOKEN_RE);
  if (!match || match.index === undefined) return null;
  return { start: match.index, end: cursor, query: match[1] ?? "" };
}

export function insertMention(value: string, mention: MentionQuery, member: MentionUser): string {
  const token = `@${mentionToken(member)} `;
  return `${value.slice(0, mention.start)}${token}${value.slice(mention.end)}`;
}

export function filterMentionMembers(members: MentionUser[], query: string): MentionUser[] {
  void query;
  return members;
}

export function mentionCandidates(
  teamMembers: TeamMember[],
  currentUser?: { name?: string | null; email?: string | null } | null,
): MentionUser[] {
  const byEmail = new Map<string, MentionUser>();
  const currentEmail = currentUser?.email?.toLowerCase() ?? null;
  for (const member of teamMembers) {
    if (!member.email) continue;
    const email = member.email.toLowerCase();
    if (email === currentEmail) continue;
    byEmail.set(email, member);
  }
  return [...byEmail.values()];
}

export function normalizeCommentThreads(comments: ReviewCommentResponse[]): CommentThread[] {
  const ordered = [...comments].sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));
  const topLevel: CommentThread[] = [];
  const byId = new Map<string, CommentThread>();

  for (const comment of ordered) {
    if (comment.parentCommentId) continue;
    const thread = { ...comment, replies: [] };
    byId.set(thread.id, thread);
    topLevel.push(thread);
  }

  for (const reply of ordered.slice().reverse()) {
    if (!reply.parentCommentId) continue;
    const parent = byId.get(reply.parentCommentId);
    if (parent) {
      parent.replies.push({ ...reply, replies: [] });
    } else {
      topLevel.push({ ...reply, replies: [] });
    }
  }

  return topLevel;
}

export function commentsForCell(
  comments: ReviewCommentResponse[],
  target: CommentTarget,
): ReviewCommentResponse[] {
  return comments.filter((comment) => commentMatchesCell(comment, target));
}

export function commentsForSheet(
  comments: ReviewCommentResponse[],
  sheetName?: string | null,
): ReviewCommentResponse[] {
  if (!sheetName) return [];
  return [...comments]
    .filter((comment) => comment.sheetName === sheetName)
    .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));
}

export function buildCellCommentIndicators(
  comments: ReviewCommentResponse[],
  options: { fieldIdCellKeys?: Map<string, string> } = {},
): Map<string, CellCommentIndicator> {
  const counts = new Map<string, number>();
  for (const comment of comments) {
    const key =
      comment.sheetName && comment.templateCell
        ? commentTargetKey(comment.sheetName, comment.templateCell)
        : comment.fieldId
          ? options.fieldIdCellKeys?.get(comment.fieldId)
          : null;
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Map(
    [...counts.entries()].map(([key, count]) => [
      key,
      { count, displayCount: formatCommentIndicatorCount(count) },
    ]),
  );
}

export function commentTargetKey(sheetName: string, templateCell: string): string {
  return `${sheetName}!${cellAddress(templateCell)}`;
}

export function cellSelectionFromComment(
  comment: Pick<ReviewCommentResponse, "templateCell">,
  sheetId: string,
): CellSelection | null {
  if (!comment.templateCell) return null;
  const parsed = parseCellAddress(comment.templateCell);
  if (!parsed) return null;
  return { sheetId, row: parsed.row, col: parsed.col };
}

export function mentionToken(member: MentionUser): string {
  const nameToken = member.name.replace(/[^A-Za-z0-9]+/g, "");
  return nameToken || member.email;
}

export function targetLabel(target: CommentTarget, fallback: string): string {
  const cell = target.templateCell
    ? commentTargetKey(target.sheetName ?? "Sheet", target.templateCell)
    : target.sheetName;
  return cell ? `${fallback} · ${cell}` : fallback;
}

function commentMatchesCell(comment: ReviewCommentResponse, target: CommentTarget): boolean {
  if (target.fieldId && comment.fieldId === target.fieldId) return true;
  return (
    !!target.sheetName &&
    !!target.templateCell &&
    comment.sheetName === target.sheetName &&
    cellAddress(comment.templateCell) === cellAddress(target.templateCell)
  );
}

function parseCellAddress(address: string): { row: number; col: number } | null {
  const normalized = cellAddress(address);
  const match = normalized.match(CELL_RE);
  if (!match) return null;
  return { col: columnIndex(match[1]), row: Number(match[2]) - 1 };
}

function cellAddress(address: string | null | undefined): string {
  if (!address) return "";
  return address.includes("!") ? (address.split("!").at(-1) ?? address) : address;
}

function columnIndex(label: string): number {
  return (
    label
      .toUpperCase()
      .split("")
      .reduce((total, char) => total * 26 + (char.charCodeAt(0) - 64), 0) - 1
  );
}

function timestamp(value: string | null | undefined): number {
  return value ? new Date(value).getTime() : 0;
}

function formatCommentIndicatorCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
