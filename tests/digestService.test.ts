import { describe, expect, it } from "vitest";
import { isDigestSendDay } from "../lib/services/digestService";

describe("isDigestSendDay", () => {
  it("allows Monday and Friday digest sends", () => {
    expect(isDigestSendDay(new Date("2026-05-18T12:00:00-07:00"))).toBe(true);
    expect(isDigestSendDay(new Date("2026-05-22T12:00:00-07:00"))).toBe(true);
  });

  it("skips digest sends on other days", () => {
    expect(isDigestSendDay(new Date("2026-05-19T12:00:00-07:00"))).toBe(false);
    expect(isDigestSendDay(new Date("2026-05-23T12:00:00-07:00"))).toBe(false);
  });
});
