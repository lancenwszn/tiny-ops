import { expect, test, type Page } from "@playwright/test";
import { createWorkspace, emailLink, signIn, signUpAndVerify, supabaseAs, uniqueEmail } from "./helpers";

// Stage 2: application shell, dashboard, search, notifications, help.
test.describe.configure({ mode: "serial" });

const owner = { name: "Nadia Bello", email: uniqueEmail("s2-owner"), password: "Organized123" };
const teammate = { name: "Tomi Ade", email: uniqueEmail("s2-mate"), password: "Teamwork456" };
const outsider = { name: "Omar Haddad", email: uniqueEmail("s2-outsider"), password: "Outside789" };
const WORKSPACE = "Lagos Laundry Co";

async function login(page: Page, user: { email: string; password: string }) {
  await signIn(page, user.email, user.password);
  await expect(page).toHaveURL(/\/app\/dashboard/);
}

test("owner sees the full dashboard with honest empty states", async ({ page }) => {
  await signUpAndVerify(page, owner);
  await createWorkspace(page, WORKSPACE, "Africa/Lagos");

  const hero = page.getByRole("region", { name: "Welcome" });
  await expect(hero.getByRole("heading", { name: /Good (morning|afternoon|evening),\s*Nadia/ })).toBeVisible();
  await expect(hero.getByText(WORKSPACE)).toBeVisible();
  await expect(hero.getByText(/Africa\/Lagos/)).toBeVisible();
  await expect(page.getByTestId("workspace-date")).not.toBeEmpty();

  // KPIs exist but show no fabricated numbers.
  const kpis = page.getByTestId("kpi");
  await expect(kpis).toHaveCount(4);
  for (const label of ["Total Tasks", "Completed Tasks", "Overdue Tasks", "Checklist Completion"]) {
    await expect(kpis.filter({ hasText: label })).toContainText("—");
  }

  for (const title of ["Operations Calendar", "Operations Health", "Getting Started", "Team Activity", "Upcoming Tasks", "Recent SOPs", "Quick Actions"]) {
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: /^TinyOps AI/ })).toBeVisible();
  await expect(page.getByText("Your health score appears once your team starts completing tasks and checklists.")).toBeVisible();
  await expect(page.getByText("Task tracking is coming soon")).toBeVisible();
  await expect(page.getByText("Your SOP Library is on its way")).toBeVisible();
  await expect(page.getByRole("button", { name: /Create SOP/ })).toBeDisabled();
  await expect(page.getByTestId("activity-item").filter({ hasText: `created the workspace ${WORKSPACE}` })).toBeVisible();
  await expect(page.getByTestId("quick-action-disabled")).toHaveCount(5);
});

test("navigation: live items link, unbuilt modules are not links, sidebar collapse persists", async ({ page }) => {
  await login(page, owner);
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByTestId("nav-soon")).toHaveCount(7);
  for (const path of ["/app/tasks", "/app/sops", "/app/checklists", "/app/calendar", "/app/team", "/app/handovers", "/app/reports"]) {
    await expect(page.locator(`a[href="${path}"]`)).toHaveCount(0);
  }

  await nav.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/app\/settings$/);
  await expect(nav.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
});

test("every link on the dashboard resolves (no dead links)", async ({ page }) => {
  await login(page, owner);
  const hrefs = await page.locator("a[href^='/']").evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("href")!))]);
  expect(hrefs).toEqual(expect.arrayContaining(["/app/dashboard", "/app/settings", "/app/settings/profile"]));
  for (const href of hrefs) {
    const res = await page.request.get(href);
    expect(res.status(), href).toBeLessThan(400);
  }
});

test("calendar navigates between months and returns to today", async ({ page }) => {
  await login(page, owner);
  const month = page.getByTestId("calendar-month");
  const current = await month.textContent();
  await expect(page.locator("[aria-current='date']")).toHaveCount(1);
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(month).not.toHaveText(current!);
  await expect(page.locator("[aria-current='date']")).toHaveCount(0);
  await page.getByRole("button", { name: "Today" }).click();
  await expect(month).toHaveText(current!);
});

test("owner invites a teammate from Quick Actions; teammate joins", async ({ page, browser }) => {
  await login(page, owner);
  await page.getByRole("region", { name: "Quick Actions" }).getByRole("button", { name: "Invite Member" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email address").fill("not-an-email");
  await dialog.getByRole("button", { name: "Create invitation" }).click();
  await expect(dialog.getByText("Enter a valid email address")).toBeVisible();
  await dialog.getByLabel("Email address").fill(teammate.email);
  await dialog.getByRole("button", { name: "Create invitation" }).click();
  const link = await dialog.getByLabel("Invitation link").inputValue();
  expect(link).toMatch(/\/invite\/[a-f0-9]{64}$/);
  await dialog.getByRole("button", { name: "Done" }).click();

  const ctx = await browser.newContext();
  const mate = await ctx.newPage();
  const invitePath = new URL(link).pathname;
  await mate.goto(invitePath);
  await mate.getByRole("link", { name: "Create account & join" }).click();
  await mate.getByLabel("Full name").fill(teammate.name);
  await mate.getByLabel("Password").fill(teammate.password);
  await mate.getByRole("button", { name: "Create account" }).click();
  await expect(mate).toHaveURL(/\/verify-email/);
  await mate.goto(await emailLink(teammate.email, /Confirm your TinyOps account/));
  await mate.getByRole("button", { name: "Accept invitation" }).click();
  await expect(mate).toHaveURL(/\/app\/dashboard/);

  // Members cannot invite.
  await expect(mate.getByRole("region", { name: "Quick Actions" }).getByLabel("Only owners and admins can invite teammates")).toBeVisible();
  await expect(mate.getByTestId("activity-item").filter({ hasText: "joined the workspace as a member" })).toBeVisible();
  await ctx.close();
});

test("owner is notified, opens the notification centre and marks items read", async ({ page }) => {
  await login(page, owner);
  await expect(page.getByTestId("unread-badge")).toHaveText("1");
  await page.getByRole("button", { name: "Notifications, 1 unread" }).click();
  await expect(page.getByTestId("notification").filter({ hasText: `${teammate.name} joined ${WORKSPACE}` })).toBeVisible();
  await page.getByRole("button", { name: "Mark all read" }).click();
  await expect(page.getByTestId("unread-badge")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await page.goto("/app/notifications");
  await expect(page.getByText("No unread notifications")).toBeVisible();
  await expect(page.getByTestId("notification")).toHaveCount(1);
});

test("search is workspace-aware and respects permissions", async ({ page, browser }) => {
  await login(page, owner);
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByLabel("Search query").fill("Tomi");
  await expect(page.getByTestId("search-member").filter({ hasText: teammate.name })).toBeVisible();
  await expect(page.getByText(/Tasks, SOPs, Checklists, Handovers become searchable/)).toBeVisible();

  // Page commands navigate.
  await page.getByLabel("Search query").fill("profile");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/app\/settings\/profile/);

  // An outsider with their own workspace cannot find people from this one.
  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await signUpAndVerify(other, outsider);
  await createWorkspace(other, "Omar Electrics");
  await other.getByRole("button", { name: "Search" }).click();
  await other.getByLabel("Search query").fill("Tomi");
  await expect(other.getByText(/No team members match/)).toBeVisible();
  await expect(other.getByTestId("search-member")).toHaveCount(0);
  // ...and their dashboard shows none of this workspace's data.
  await other.keyboard.press("Escape");
  await expect(other.getByText(WORKSPACE)).toHaveCount(0);
  await expect(other.getByTestId("activity-item").filter({ hasText: teammate.name })).toHaveCount(0);
  await ctx.close();

  // Direct RPC call against a foreign workspace returns nothing.
  const outsiderClient = await supabaseAs(outsider.email, outsider.password);
  const ownerClient = await supabaseAs(owner.email, owner.password);
  const { data: ws } = await ownerClient.from("workspaces").select("id").eq("name", WORKSPACE).single();
  const { data } = await outsiderClient.rpc("search_workspace", { p_workspace_id: ws!.id, p_query: "Tomi" });
  expect(data).toEqual([]);
});

test("existing users receive invitations in their notification centre", async ({ page, browser }) => {
  await login(page, owner);
  await page.getByRole("region", { name: "Quick Actions" }).getByRole("button", { name: "Invite Member" }).click();
  await page.getByRole("dialog").getByLabel("Email address").fill(outsider.email);
  await page.getByRole("dialog").getByRole("button", { name: "Create invitation" }).click();
  await expect(page.getByRole("dialog").getByLabel("Invitation link")).toBeVisible();

  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await login(other, outsider);
  await other.getByRole("button", { name: "Notifications, 1 unread" }).click();
  await other.getByTestId("notification").filter({ hasText: `You're invited to join ${WORKSPACE}` }).click();
  await expect(other).toHaveURL(/\/invite\//);
  await other.getByRole("button", { name: "Accept invitation" }).click();
  await expect(other).toHaveURL(/\/app\/dashboard/);
  await expect(other.getByRole("region", { name: "Welcome" }).getByText(WORKSPACE)).toBeVisible();
  // The invitation notification is gone once accepted.
  await expect(other.getByTestId("unread-badge")).toHaveCount(0);
  await ctx.close();
});

test("help menu: getting started and about dialogs; unconfigured links are disabled", async ({ page }) => {
  await login(page, owner);
  await page.getByRole("button", { name: "Help" }).click();
  await expect(page.getByRole("menuitem", { name: /Help documentation/ })).toHaveAttribute("data-disabled", "");
  await expect(page.getByRole("menuitem", { name: /Contact support/ })).toHaveAttribute("data-disabled", "");
  await page.getByRole("menuitem", { name: "Getting started" }).click();
  await expect(page.getByRole("dialog", { name: "Getting started with TinyOps" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Help" }).click();
  await page.getByRole("menuitem", { name: "About TinyOps" }).click();
  await expect(page.getByRole("dialog", { name: "About TinyOps" })).toContainText("SZN Labs");
});

test("workspace switching updates the dashboard", async ({ page }) => {
  await login(page, outsider);
  // The outsider now belongs to two workspaces (own + Lagos Laundry Co).
  const hero = page.getByRole("region", { name: "Welcome" });
  const sidebar = page.locator("aside");
  const target = (await hero.textContent())?.includes(WORKSPACE) ? "Omar Electrics" : WORKSPACE;
  await sidebar.getByRole("button", { name: /Switch workspace/ }).click();
  await page.getByRole("menuitem", { name: new RegExp(target) }).click();
  await expect(hero.getByText(target)).toBeVisible();
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("mobile navigation drawer and workspace switcher", async ({ page }) => {
    await login(page, owner);
    await expect(page.getByRole("button", { name: /Switch workspace/ })).toBeVisible();
    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await expect(drawer.getByRole("button", { name: /Switch workspace/ })).toBeVisible();
    await drawer.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/app\/settings$/);
    await expect(drawer).toBeHidden();
    await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);
  });
});
