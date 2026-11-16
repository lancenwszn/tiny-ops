import { describe, expect, it } from "vitest";
import { computeKpis, computeOperationsHealth, rate } from "@/features/dashboard/metrics";
import { describeActivity } from "@/features/dashboard/activity";
import { buildMonthGrid, shiftMonth, todayInTimezone } from "@/features/dashboard/calendar";
import { normalizeQuery, searchSources } from "@/features/search/sources";
import { modules } from "@/lib/modules";
import { mainNav } from "@/components/layout/nav";

describe("dashboard metrics", () => {
  it("never fabricates numbers when modules are not live", () => {
    const kpis = computeKpis({});
    for (const metric of Object.values(kpis)) expect(metric.state).toBe("unavailable");
    const health = computeOperationsHealth({});
    expect(health.score).toBeNull();
    expect(health.rows.every((r) => r.metric.state === "unavailable")).toBe(true);
  });

  it("computes KPIs from task and checklist stats", () => {
    const kpis = computeKpis({ tasks: { total: 12, completed: 5, overdue: 2, open: 7 }, checklists: { due: 4, completed: 3, pending: 1 } });
    expect(kpis.totalTasks).toMatchObject({ state: "ready", value: 12, caption: "7 open" });
    expect(kpis.overdueTasks).toMatchObject({ value: 2, caption: "Needs attention" });
    expect(kpis.checklistCompletion).toMatchObject({ display: "75%", caption: "3 of 4 done" });
  });

  it("handles modules with no data yet without dividing by zero", () => {
    const kpis = computeKpis({ tasks: { total: 0, completed: 0, overdue: 0, open: 0 }, checklists: { due: 0, completed: 0, pending: 0 } });
    expect(kpis.checklistCompletion).toMatchObject({ state: "ready", caption: "Nothing due yet" });
    expect(computeOperationsHealth({ tasks: { total: 0, completed: 0, overdue: 0, open: 0 } }).score).toBeNull();
  });

  it("scores operations health with an overdue penalty", () => {
    // tasks 50%, checklists 100% -> 75, overdue 2/10 -> penalty 8 -> 67
    const { score } = computeOperationsHealth({
      tasks: { total: 10, completed: 5, overdue: 2, open: 5 },
      checklists: { due: 2, completed: 2, pending: 0 },
    });
    expect(score).toBe(67);
  });

  it("caps the overdue penalty and clamps the score", () => {
    const { score } = computeOperationsHealth({ tasks: { total: 4, completed: 0, overdue: 4, open: 4 } });
    expect(score).toBe(0);
    expect(rate(5, 4)).toBe(1);
  });
});

describe("activity descriptions", () => {
  it.each([
    [{ action: "workspace.created", metadata: { name: "Brightside" } }, "created the workspace Brightside"],
    [{ action: "member.joined", metadata: { role: "admin" } }, "joined the workspace as an admin"],
    [{ action: "member.invited", metadata: { role: "member" } }, "invited a new member"],
    [{ action: "member.role_changed", metadata: { name: "Sam", to: "admin" } }, "made Sam an admin"],
    [{ action: "member.left", metadata: {} }, "left the workspace"],
    [{ action: "invitation.revoked", metadata: {} }, "revoked a pending invitation"],
    [{ action: "something.new", metadata: {} }, "made an update"],
  ])("describes %o", (entry, text) => {
    expect(describeActivity(entry).text).toBe(text);
  });

  it("combines several workspace changes", () => {
    const { text } = describeActivity({
      action: "workspace.updated",
      metadata: { changes: { name: { from: "A", to: "B" }, timezone: { to: "America/New_York" }, logo: true } },
    });
    expect(text).toBe("renamed the workspace to B, set the timezone to America/New York and updated the business logo");
  });
});

describe("calendar grid", () => {
  it("builds a 6-week Sunday-first grid", () => {
    const grid = buildMonthGrid(2026, 10); // November 2026 starts on a Sunday
    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({ date: "2026-11-01", day: 1, inMonth: true });
    expect(grid.filter((c) => c.inMonth)).toHaveLength(30);
  });

  it("pads with the previous month", () => {
    const grid = buildMonthGrid(2025, 7); // August 2025 starts on a Friday
    expect(grid[0].date).toBe("2025-07-27");
    expect(grid[5]).toEqual({ date: "2025-08-01", day: 1, inMonth: true });
  });

  it("handles leap years and year boundaries", () => {
    expect(buildMonthGrid(2028, 1).filter((c) => c.inMonth)).toHaveLength(29);
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });

  it("computes today in the workspace timezone", () => {
    const instant = new Date("2026-11-16T23:30:00Z");
    expect(todayInTimezone("UTC", instant)).toBe("2026-11-16");
    expect(todayInTimezone("Asia/Tokyo", instant)).toBe("2026-11-17");
    expect(todayInTimezone("America/Los_Angeles", instant)).toBe("2026-11-16");
  });
});

describe("search", () => {
  it("normalizes queries", () => {
    expect(normalizeQuery("  sam   rivera ")).toBe("sam rivera");
    expect(normalizeQuery("a")).toBeNull();
    expect(normalizeQuery(42)).toBeNull();
    expect(normalizeQuery("x".repeat(300))).toHaveLength(100);
  });

  it("only searches sources whose module is live (members are always searchable)", () => {
    for (const s of searchSources) {
      expect(s.searchable).toBe(s.kind === "member" ? true : modules[s.module].available);
    }
  });
});

describe("navigation", () => {
  it("contains the nine sidebar items in order", () => {
    expect(mainNav.map((n) => n.label)).toEqual([
      "Dashboard", "My Tasks", "SOP Library", "Checklists", "Calendar", "Team", "Handovers", "Reports", "Settings",
    ]);
  });

  it("marks items available only when their module is live", () => {
    for (const item of mainNav) {
      const mod = Object.values(modules).find((m) => m.href === item.href);
      if (mod) expect(item.available).toBe(mod.available);
    }
  });
});
