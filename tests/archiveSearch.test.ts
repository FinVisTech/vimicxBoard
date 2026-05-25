import { describe, expect, it } from "vitest";
import { buildArchiveSearchResults, splitHighlightedText, type ArchiveSearchTask } from "../lib/archiveSearch";

const baseTask: ArchiveSearchTask = {
  id: "task-base",
  title: "Base task",
  description: null,
  archivedAt: "2026-05-10T12:00:00.000Z",
  updatedAt: "2026-05-10T12:00:00.000Z",
  column: { name: "Done" },
  assignee: null,
  comments: []
};

describe("archive search", () => {
  it("ranks title matches above description and comment-only matches", () => {
    const results = buildArchiveSearchResults(
      [
        {
          ...baseTask,
          id: "comment",
          title: "Unrelated",
          comments: [{ id: "comment-1", body: "Needs sonar review", createdAt: "2026-05-11T12:00:00.000Z" }]
        },
        { ...baseTask, id: "description", title: "Unrelated", description: "Needs sonar review" },
        { ...baseTask, id: "title", title: "Sonar review" }
      ],
      "sonar"
    );

    expect(results.map((task) => task.id)).toEqual(["title", "description", "comment"]);
  });

  it("matches assignee names", () => {
    const results = buildArchiveSearchResults([{ ...baseTask, assignee: { name: "Dalton" } }], "dalton");

    expect(results).toHaveLength(1);
    expect(results[0].matchedFields).toContain("assignee");
  });

  it("returns compact comment snippets for matching archived comments", () => {
    const body =
      "This older archive note has a long lead-in before the important calibration detail and then a longer tail that should be shortened. The remaining context keeps going with unrelated deployment notes, timestamps, and follow-up details that do not need to fill the archive card.";
    const results = buildArchiveSearchResults(
      [
        {
          ...baseTask,
          comments: [{ id: "comment-1", body, createdAt: "2026-05-11T12:00:00.000Z" }]
        }
      ],
      "calibration"
    );

    expect(results[0].commentSnippets).toHaveLength(1);
    expect(results[0].commentSnippets[0].body).toContain("calibration");
    expect(results[0].commentSnippets[0].body.length).toBeLessThan(body.length);
  });

  it("highlights each keyword case-insensitively", () => {
    const chunks = splitHighlightedText("Luke checked SONAR alignment", "luke sonar");

    expect(chunks.filter((chunk) => chunk.isMatch).map((chunk) => chunk.text)).toEqual(["Luke", "SONAR"]);
  });
});
