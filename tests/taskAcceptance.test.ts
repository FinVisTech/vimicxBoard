import { describe, expect, it } from "vitest";
import {
  buildAcceptedAcceptanceView,
  buildClarificationAcceptanceView,
  buildClarificationModalCustomId,
  buildClarificationResponseView,
  buildTaskAcceptancePanelView,
  parseAcceptanceCustomId
} from "../lib/services/taskAcceptanceService";
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

  it("builds one grouped assignment panel with per-owner actions", () => {
    const acceptances = [
      {
        status: "PENDING",
        taskId: "task123",
        userId: "user456",
        task: { title: "Test task" },
        user: { name: "Luke", discordUserId: "1336835474152620167" }
      },
      {
        status: "PENDING",
        taskId: "task123",
        userId: "user789",
        task: { title: "Test task" },
        user: { name: "Dalton", discordUserId: "222222222222222222" }
      }
    ];

    const view = buildTaskAcceptancePanelView(acceptances as any, {
      mentionUserIds: new Set(["user456", "user789"])
    });

    expect(view.content).toContain("An additional task has been added to the board.");
    expect(view.content).toContain("<@1336835474152620167> <@222222222222222222> you are part of this deliverable:");
    expect(view.content).toContain("**Test task**");
    expect(view.components[0].components[0]).toMatchObject({ label: "Open task" });
    expect(view.components[1].components[0]).toMatchObject({ label: "Luke:", disabled: true });
    expect(view.components[1].components[1]).toMatchObject({ label: "Accept", custom_id: "task-owner:accept:task123:user456", style: 3 });
    expect(view.components[1].components[2]).toMatchObject({ label: "I need clarification", custom_id: "task-owner:clarify:task123:user456" });
    expect(view.components[1].components[3]).toMatchObject({ label: "Pending", disabled: true, style: 1 });
    expect(view.components[2].components[0]).toMatchObject({ label: "Dalton:", disabled: true });
    expect(view.components[2].components[2]).toMatchObject({ label: "I need clarification", custom_id: "task-owner:clarify:task123:user789" });
  });

  it("updates grouped panels with resolved owner status", () => {
    const accepted = {
      status: "PENDING",
      taskId: "task123",
      userId: "user456",
      task: { title: "Test task" },
      user: { name: "Luke" }
    };
    const clarification = { ...accepted };

    const acceptedView = buildAcceptedAcceptanceView(accepted as any);
    const clarificationView = buildClarificationAcceptanceView(clarification as any);

    expect(acceptedView.components[1].components[1]).toMatchObject({ label: "Accept", disabled: true, style: 3 });
    expect(acceptedView.components[1].components[3]).toMatchObject({ label: "Accepted", disabled: true, style: 3 });
    expect(clarificationView.components[1].components[2]).toMatchObject({ label: "I need clarification", disabled: true, style: 4 });
    expect(clarificationView.components[1].components[3]).toMatchObject({ label: "Clarification needed", disabled: true, style: 4 });
  });

  it("builds a fresh owner prompt after clarification is added", () => {
    const acceptances = [
      {
        status: "PENDING",
        taskId: "task123",
        userId: "user456",
        task: { title: "Test task" },
        user: { name: "Luke", discordUserId: "1336835474152620167" }
      }
    ];

    const view = buildClarificationResponseView(acceptances as any, "Here is the missing context.", new Set(["user456"]));

    expect(view.content).toContain("<@1336835474152620167>");
    expect(view.content).toContain("Clarification added:");
    expect(view.components[0].components[0]).toMatchObject({ label: "Open task" });
    expect(view.components[1].components[0]).toMatchObject({ label: "Luke:" });
    expect(view.components[1].components[1]).toMatchObject({ label: "Accept", custom_id: "task-owner:accept:task123:user456" });
    expect(view.components[1].components[2]).toMatchObject({ label: "I need clarification", custom_id: "task-owner:clarify:task123:user456" });
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
