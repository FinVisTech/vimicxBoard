export type ArchiveSearchComment = {
  id: string;
  body: string;
  createdAt: Date | string;
};

export type ArchiveSearchTask = {
  id: string;
  title: string;
  description: string | null;
  archivedAt: Date | string | null;
  updatedAt: Date | string;
  column: { name: string };
  assignee: { name: string } | null;
  comments: ArchiveSearchComment[];
};

export type ArchiveCommentSnippet = {
  id: string;
  body: string;
  createdAt: string;
};

export type ArchiveSearchResult = {
  id: string;
  title: string;
  description: string | null;
  archivedAt: string | null;
  updatedAt: string;
  columnName: string;
  assigneeName: string | null;
  latestNote: string | null;
  commentSnippets: ArchiveCommentSnippet[];
  matchedFields: string[];
};

export type HighlightChunk = {
  text: string;
  isMatch: boolean;
};

const MAX_SNIPPETS_PER_TASK = 2;
const SNIPPET_RADIUS = 70;

export function tokenizeArchiveQuery(query: string) {
  return Array.from(new Set(query.toLowerCase().trim().split(/\s+/).filter(Boolean)));
}

export function buildArchiveSearchResults(tasks: ArchiveSearchTask[], query: string): ArchiveSearchResult[] {
  const tokens = tokenizeArchiveQuery(query);

  return tasks
    .map((task) => ({ task, match: scoreTask(task, tokens) }))
    .filter(({ match }) => tokens.length === 0 || match.score > 0)
    .sort((left, right) => {
      if (right.match.score !== left.match.score) return right.match.score - left.match.score;
      return toTimestamp(right.task.archivedAt ?? right.task.updatedAt) - toTimestamp(left.task.archivedAt ?? left.task.updatedAt);
    })
    .map(({ task, match }) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      archivedAt: serializeDate(task.archivedAt),
      updatedAt: serializeDate(task.updatedAt) ?? new Date(0).toISOString(),
      columnName: task.column.name,
      assigneeName: task.assignee?.name ?? null,
      latestNote: tokens.length === 0 ? task.comments[0]?.body ?? null : null,
      commentSnippets: tokens.length === 0 ? [] : match.commentSnippets,
      matchedFields: Array.from(match.fields)
    }));
}

export function splitHighlightedText(text: string, query: string): HighlightChunk[] {
  const tokens = tokenizeArchiveQuery(query);
  if (!text || tokens.length === 0) return [{ text, isMatch: false }];

  const escapedTokens = tokens.map(escapeRegExp).filter(Boolean);
  if (escapedTokens.length === 0) return [{ text, isMatch: false }];

  const pattern = new RegExp(`(${escapedTokens.join("|")})`, "gi");
  const parts = text.split(pattern).filter((part) => part.length > 0);
  return parts.map((part) => ({
    text: part,
    isMatch: tokens.includes(part.toLowerCase())
  }));
}

function scoreTask(task: ArchiveSearchTask, tokens: string[]) {
  const fields = new Set<string>();
  const commentSnippets: ArchiveCommentSnippet[] = [];
  if (tokens.length === 0) return { score: 0, fields, commentSnippets };

  let score = 0;
  score += scoreField(task.title, tokens, 8, fields, "title");
  score += scoreField(task.assignee?.name ?? "", tokens, 6, fields, "assignee");
  score += scoreField(task.description ?? "", tokens, 4, fields, "description");

  for (const comment of task.comments) {
    const commentScore = scoreField(comment.body, tokens, 2, fields, "comments");
    if (commentScore > 0) {
      score += commentScore;
      if (commentSnippets.length < MAX_SNIPPETS_PER_TASK) {
        commentSnippets.push({
          id: comment.id,
          body: createSnippet(comment.body, tokens),
          createdAt: serializeDate(comment.createdAt) ?? new Date(0).toISOString()
        });
      }
    }
  }

  return { score, fields, commentSnippets };
}

function scoreField(text: string, tokens: string[], weight: number, fields: Set<string>, fieldName: string) {
  const normalized = text.toLowerCase();
  const hits = tokens.filter((token) => normalized.includes(token)).length;
  if (hits > 0) fields.add(fieldName);
  return hits * weight;
}

function createSnippet(text: string, tokens: string[]) {
  const normalized = text.toLowerCase();
  const firstIndex = tokens.reduce((best, token) => {
    const index = normalized.indexOf(token);
    if (index === -1) return best;
    return best === -1 ? index : Math.min(best, index);
  }, -1);

  if (firstIndex === -1 || text.length <= SNIPPET_RADIUS * 2) return text;

  const start = Math.max(0, firstIndex - SNIPPET_RADIUS);
  const end = Math.min(text.length, firstIndex + SNIPPET_RADIUS);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

function serializeDate(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function toTimestamp(value: Date | string | null | undefined) {
  if (!value) return 0;
  return new Date(value).getTime();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
