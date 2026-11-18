import { expect, test, type Page } from "@playwright/test";
import { createConfirmedUser, joinWorkspace, signIn, supabaseAs, uniqueEmail } from "./helpers";

// Stage 3 audit fixes, verified through the real UI and HTTP routes.
test.describe.configure({ mode: "serial" });

const owner = { name: "Hana Owner", email: uniqueEmail("hard-owner"), password: "Organized123" };
const member = { name: "Ivo Member", email: uniqueEmail("hard-member"), password: "Member12345" };
let workspaceId = "";
let sopId = "";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");

async function login(page: Page, user: { email: string; password: string }) {
  await signIn(page, user.email, user.password);
  await expect(page).toHaveURL(/\/app\/dashboard/);
}

async function waitSaved(page: Page) {
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved", { timeout: 15_000 });
}

/** Opens the editor and waits until it is hydrated (the rich-text editors mount client-side). */
async function openEditor(page: Page) {
  await page.goto(`/app/sops/${sopId}/edit`);
  await expect(page.getByRole("textbox", { name: "Purpose" })).toBeVisible();
}

async function publish(page: Page, note: string) {
  await page.getByRole("button", { name: /^Publish( changes)?$/ }).click();
  await page.getByRole("dialog").getByLabel(/revision note/).fill(note);
  await page.getByRole("dialog").getByRole("button", { name: "Publish" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/sops/${sopId}$`));
}

test.beforeAll(async () => {
  await createConfirmedUser(owner.email, owner.password, owner.name);
  await createConfirmedUser(member.email, member.password, member.name);
  const o = await supabaseAs(owner.email, owner.password);
  workspaceId = (await o.rpc("create_workspace", { p_name: "Hardening Co", p_timezone: "UTC" })).data as string;
  await joinWorkspace(owner.email, owner.password, workspaceId, member.email, member.password);

  // A confidential draft and a published SOP.
  await o.rpc("create_sop", { p_workspace_id: workspaceId, p_title: "CONFIDENTIAL redundancy plan" });
  sopId = (await o.rpc("create_sop", { p_workspace_id: workspaceId, p_title: "Closing procedure" })).data as string;
  await o.rpc("save_sop_draft", {
    p_sop_id: sopId, p_expected_revision: 0, p_title: "Closing procedure", p_description: "", p_category_id: null,
    p_owner_id: null, p_requires_acknowledgment: false, p_sections: {}, p_steps: [],
  });
  await o.rpc("publish_sop", { p_sop_id: sopId, p_note: "" });
});

test("H1: members never see draft titles in the activity feed", async ({ page }) => {
  await login(page, member);
  const feed = page.getByRole("region", { name: "Team Activity" });
  await expect(feed.getByTestId("activity-item").filter({ hasText: "Closing procedure" }).first()).toBeVisible();
  await expect(page.getByText(/CONFIDENTIAL/)).toHaveCount(0);

  const memberClient = await supabaseAs(member.email, member.password);
  const { data } = await memberClient.from("activity_log").select("metadata").eq("workspace_id", workspaceId);
  expect(JSON.stringify(data)).not.toContain("CONFIDENTIAL");
});

test("H2 + M1: unpublished files and settings stay invisible to members until published", async ({ page, browser }) => {
  await login(page, owner);
  await openEditor(page);
  await page.getByLabel("Upload attachments").setInputFiles({ name: "new-rota.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(page.getByRole("region", { name: "Attachments" }).getByTestId("attachment")).toHaveCount(1);
  await page.getByLabel("Require acknowledgment").check();
  await expect(page.getByText("Category, owner and acknowledgment changes go live when you publish.")).toBeVisible();
  await waitSaved(page);

  const ownerClient = await supabaseAs(owner.email, owner.password);
  const { data: file } = await ownerClient.from("sop_attachments").select("id").eq("file_name", "new-rota.pdf").single();

  const ctx = await browser.newContext();
  const m = await ctx.newPage();
  await login(m, member);
  await m.goto(`/app/sops/${sopId}`);
  await expect(m.getByRole("heading", { name: "Closing procedure", level: 1 })).toBeVisible();
  await expect(m.getByText("new-rota.pdf")).toHaveCount(0);
  await expect(m.getByTestId("ack-card")).toHaveCount(0);
  expect((await m.request.get(`/api/sops/attachments/${file!.id}`, { maxRedirects: 0 })).status()).toBe(404);

  await publish(page, "New rota and acknowledgment");
  await m.reload();
  await expect(m.getByRole("button", { name: "Download new-rota.pdf" })).toBeVisible();
  await expect(m.getByTestId("ack-card").filter({ visible: true })).toHaveAttribute("data-state", "pending");
  expect((await m.request.get(`/api/sops/attachments/${file!.id}`, { maxRedirects: 0 })).status()).toBe(302);

  // Removing a published file keeps it for readers until the next publish.
  await openEditor(page);
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Remove new-rota.pdf" }).click();
  await expect(page.getByText(/Readers keep it until you publish/)).toBeVisible();
  await m.reload();
  await expect(m.getByRole("button", { name: "Download new-rota.pdf" })).toBeVisible();
  await ctx.close();
});

test("M2: a member assigned as owner is told only once the SOP is published", async ({ page, browser }) => {
  await login(page, owner);
  await openEditor(page);
  await page.getByLabel("SOP owner", { exact: true }).selectOption({ label: `${member.name} (member)` });
  await waitSaved(page);

  const memberClient = await supabaseAs(member.email, member.password);
  const count = async () =>
    (await memberClient.from("notifications").select("id").eq("type", "sop.owner_assigned")).data?.length ?? 0;
  expect(await count()).toBe(0);
  await publish(page, "New owner");
  expect(await count()).toBe(1);

  const ctx = await browser.newContext();
  const m = await ctx.newPage();
  await login(m, member);
  await m.getByRole("button", { name: /Notifications/ }).click();
  await m.getByTestId("notification").filter({ hasText: "You're now the owner of “Closing procedure”" }).click();
  await expect(m.getByRole("heading", { name: "Closing procedure", level: 1 })).toBeVisible();
  await ctx.close();
});

test("M6: navigating away with unsaved edits asks first, and work is recoverable on this device", async ({ page }) => {
  await login(page, owner);
  await openEditor(page);
  await waitSaved(page);
  await page.getByRole("textbox", { name: "Purpose" }).click();
  await page.keyboard.type("Lock the back door.");

  // Non-link navigation (command palette -> router.push) is guarded too.
  let asked = "";
  page.once("dialog", (d) => {
    asked = d.message();
    void d.dismiss();
  });
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByLabel("Search query").fill("profile");
  await page.keyboard.press("Enter");
  expect(asked).toContain("haven't been saved");
  await expect(page).toHaveURL(/\/edit$/);
  await page.keyboard.press("Escape");
  await waitSaved(page);

  // Simulate edits that never reached the server (e.g. browser crash) and reload.
  await page.evaluate((key) => {
    const content = {
      title: "Closing procedure",
      description: "",
      categoryId: null,
      ownerId: null,
      requiresAck: true,
      sections: { notes: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Recovered from this device" }] }] } },
      steps: [],
    };
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: Date.now(), content }));
  }, `tinyops:sop-draft-backup:${sopId}`);
  await page.reload();
  await expect(page.getByTestId("recovery-banner")).toBeVisible();
  await page.getByRole("button", { name: "Restore my changes" }).click();
  await expect(page.getByRole("textbox", { name: "Additional notes" })).toContainText("Recovered from this device");
  await waitSaved(page);
  await page.reload();
  await expect(page.getByTestId("recovery-banner")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Additional notes" })).toContainText("Recovered from this device");
});

test("M6: archived SOPs open read-only (no editing, no save loop)", async ({ page }) => {
  await login(page, owner);
  const o = await supabaseAs(owner.email, owner.password);
  await o.rpc("archive_sop", { p_sop_id: sopId });
  await openEditor(page);
  await expect(page.getByText("This SOP is archived and read-only.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Purpose" })).toHaveAttribute("contenteditable", "false");
  await expect(page.getByTestId("save-state")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Purpose" }).getByRole("toolbar")).toHaveCount(0);
  await o.rpc("unarchive_sop", { p_sop_id: sopId });
});

test("M4: the storage cleanup job requires the cron secret", async ({ request }) => {
  expect((await request.get("/api/cron/storage-cleanup")).status()).toBe(401);
  expect((await request.get("/api/cron/storage-cleanup", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
  const ok = await request.get("/api/cron/storage-cleanup", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toEqual({ deleted: expect.any(Number) });
});
