import { describe, expect, it } from "vitest";
import { createTaskSchema } from "../lib/validators/tasks";

describe("task creation payload", () => {
  it("accepts a minimal fast-capture task", () => {
    const parsed = createTaskSchema.parse({
      title: "Call 3 marine electronics dealers",
      assigneeName: "Luke",
      source: "DISCORD"
    });

    expect(parsed.columnName).toBe("To Do");
    expect(parsed.priority).toBe("MEDIUM");
    expect(parsed.source).toBe("DISCORD");
    expect(parsed.isBlocked).toBe(false);
  });

  it("accepts board-selected DM recipients for manual web tasks", () => {
    const parsed = createTaskSchema.parse({
      title: "Follow up with dealer",
      assigneeIds: ["user-1", "user-2"],
      dmUserIds: ["user-2"],
      source: "WEB"
    });

    expect(parsed.dmUserIds).toEqual(["user-2"]);
  });

  it("rejects blank titles before the database layer", () => {
    expect(() => createTaskSchema.parse({ title: " " })).toThrow();
  });
});
