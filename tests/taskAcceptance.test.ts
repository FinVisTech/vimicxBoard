import { describe, expect, it } from "vitest";
import { buildClarificationModalCustomId, parseAcceptanceCustomId } from "../lib/services/taskAcceptanceService";
import { formatDigestMessage } from "../lib/services/digestService";

describe("task acceptance Discord custom IDs", () => {
  it("parses owner acceptance button IDs", () => {
    expect(parseAcceptanceCustomId("task-owner:accept:task123:user456")).toEqual({
      action: "ACCEPT",
      taskId: "task123",
      userId: "user456"
    });
  });

  it("builds and parses clarification modal IDs", () => {
    const customId = buildClarificationModalCustomId("task123", "user456");

    expect(customId).toBe("task-owner:clarify-modal:task123:user456");
    expect(parseAcceptanceCustomId(customId)).toEqual({
      action: "CLARIFY_MODAL",
      taskId: "task123",
      userId: "user456"
    });
  });

  it("ignores unrelated custom IDs", () => {
    expect(parseAcceptanceCustomId("other:accept:task123:user456")).toBeNull();
  });
});

describe("task acceptance digest sections", () => {
  it("includes pending and clarification-needed ownership sections", () => {
    const message = formatDigestMessage({
      dueToday: [],
      overdue: [],
      inProgress: [],
      blocked: [],
      completedYesterday: [],
      unassigned: [],
      awaitingAcceptance: [
        {
          title: "Test turret yaw calibration",
          assignees: [],
          acceptances: [{ status: "PENDING", user: { name: "Dalton" } }]
        }
      ],
      needsClarification: [
        {
          title: "Build dealer demo script",
          assignees: [],
          acceptances: [{ status: "NEEDS_CLARIFICATION", user: { name: "Luke" } }]
        }
      ]
    });

    expect(message).toContain("**Awaiting Owner Acceptance:**\n- Dalton: Test turret yaw calibration");
    expect(message).toContain("**Needs Clarification:**\n- Luke: Build dealer demo script");
  });
});
