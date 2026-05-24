import { describe, expect, it } from "vitest";
import { getDoneArchiveCutoff, shouldAutoArchiveDoneTask } from "../lib/services/archiveService";

describe("archiveService", () => {
  it("calculates the Done archive cutoff from the workspace day setting", () => {
    expect(getDoneArchiveCutoff(7, new Date("2026-05-23T12:00:00-07:00")).toISOString()).toBe("2026-05-16T19:00:00.000Z");
  });

  it("auto-archives completed Done tasks after the configured number of days", () => {
    const now = new Date("2026-05-23T12:00:00-07:00");
    expect(
      shouldAutoArchiveDoneTask({
        completedAt: new Date("2026-05-16T12:00:00-07:00"),
        archivedAt: null,
        archiveDoneAfterDays: 7,
        now
      })
    ).toBe(true);
  });

  it("does not auto-archive active, already archived, or too-recent tasks", () => {
    const now = new Date("2026-05-23T12:00:00-07:00");
    expect(shouldAutoArchiveDoneTask({ completedAt: null, archivedAt: null, archiveDoneAfterDays: 7, now })).toBe(false);
    expect(
      shouldAutoArchiveDoneTask({
        completedAt: new Date("2026-05-10T12:00:00-07:00"),
        archivedAt: new Date("2026-05-17T12:00:00-07:00"),
        archiveDoneAfterDays: 7,
        now
      })
    ).toBe(false);
    expect(
      shouldAutoArchiveDoneTask({
        completedAt: new Date("2026-05-20T12:00:00-07:00"),
        archivedAt: null,
        archiveDoneAfterDays: 7,
        now
      })
    ).toBe(false);
  });
});
