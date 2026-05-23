import { describe, expect, it } from "vitest";
import { parseWithHeuristics } from "../lib/parseBoardCommand";

const users = [
  { id: "u1", name: "Luke", discordUserId: null },
  { id: "u2", name: "Dalton", discordUserId: null }
];
const tasks = [
  { id: "t1", title: "Jetson setup", columnName: "To Do", assigneeName: "Dalton" },
  { id: "t2", title: "Dealer demo script", columnName: "Backlog", assigneeName: "Luke" }
];
const columns = ["Backlog", "To Do", "In Progress", "Blocked", "Done"];

describe("parseWithHeuristics", () => {
  it("creates a task from a natural Discord command", () => {
    const parsed = parseWithHeuristics({
      rawText: "@board add task for Dalton to test turret yaw calibration before Friday",
      knownUsers: users,
      knownTasks: tasks,
      columns,
      now: new Date("2026-05-18T12:00:00-07:00")
    });

    expect(parsed.intent).toBe("CREATE_TASK");
    expect(parsed.confidence).toBeGreaterThan(0.9);
    expect(parsed.task?.title).toBe("Test turret yaw calibration");
    expect(parsed.task?.assigneeName).toBe("Dalton");
    expect(parsed.task?.columnName).toBe("To Do");
    expect(parsed.task?.dueDateNaturalLanguage).toBe("before Friday");
  });

  it("parses move commands without mutating state", () => {
    const parsed = parseWithHeuristics({
      rawText: "@board move \"Jetson setup\" to In Progress",
      knownUsers: users,
      knownTasks: tasks,
      columns
    });

    expect(parsed.intent).toBe("MOVE_TASK");
    expect(parsed.targetTask?.titleOrId).toBe("Jetson setup");
    expect(parsed.task?.columnName).toBe("In Progress");
  });

  it("asks for clarification when a target column is unknown", () => {
    const parsed = parseWithHeuristics({
      rawText: "@board move \"Jetson setup\" to Waiting Somewhere",
      knownUsers: users,
      knownTasks: tasks,
      columns
    });

    expect(parsed.intent).toBe("MOVE_TASK");
    expect(parsed.confidence).toBeLessThan(0.7);
    expect(parsed.responseMessage).toContain("Which column");
  });
});
