import { expect, test, type Page } from "@playwright/test";
import { createConfirmedUser, joinWorkspace, signIn, supabaseAs, uniqueEmail } from "./helpers";

// Stage 3: SOP Library end to end.
test.describe.configure({ mode: "serial" });

const owner = { name: "Grace Obi", email: uniqueEmail("s3-owner"), password: "Organized123" };
const member = { name: "Kemi Lawal", email: uniqueEmail("s3-member"), password: "Member12345" };
const outsider = { name: "Victor Stone", email: uniqueEmail("s3-out"), password: "Outsider123" };
let workspaceId = "";
let sopUrl = "";
let pdfAttachmentId = "";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");

async function login(page: Page, user: { email: string; password: string }) {
  await signIn(page, user.email, user.password);
  await expect(page).toHaveURL(/\/app\/dashboard/);
}

const NOT_FOUND = "This page isn't organized yet";

async function expectNotFound(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByRole("heading", { name: NOT_FOUND })).toBeVisible();
}

async function waitSaved(page: Page) {
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved", { timeout: 15_000 });
}

test.beforeAll(async () => {
  await createConfirmedUser(owner.email, owner.password, owner.name);
  await createConfirmedUser(member.email, member.password, member.name);
  await createConfirmedUser(outsider.email, outsider.password, outsider.name);
  const o = await supabaseAs(owner.email, owner.password);
  const { data } = await o.rpc("create_workspace", { p_name: "Harbor Bakery", p_timezone: "Europe/London" });
  workspaceId = data as string;
  await joinWorkspace(owner.email, owner.password, workspaceId, member.email, member.password);
  const x = await supabaseAs(outsider.email, outsider.password);
  await x.rpc("create_workspace", { p_name: "Stone Plumbing", p_timezone: "UTC" });
});

test("categories: defaults exist; create, rename and archive", async ({ page }) => {
  await login(page, owner);
  await page.goto("/app/sops/categories");
  const rows = page.getByTestId("category-row");
  await expect(rows).toHaveCount(7);
  for (const name of ["Administration", "Operations", "Sales", "Marketing", "Customer Service", "Finance", "Human Resources"]) {
    await expect(rows.filter({ hasText: name })).toHaveCount(1);
  }

  await page.getByRole("button", { name: "New category" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Kitchen");
  await page.getByRole("dialog").getByLabel("Description").fill("Food prep and hygiene");
  await page.getByRole("dialog").getByRole("button", { name: "Create category" }).click();
  await expect(rows.filter({ hasText: "Kitchen" })).toContainText("Food prep and hygiene");

  await page.getByRole("button", { name: "Actions for Marketing" }).click();
  await page.getByRole("menuitem", { name: "Rename or describe" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Marketing & Social");
  await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
  await expect(rows.filter({ hasText: "Marketing & Social" })).toHaveCount(1);

  await page.getByRole("button", { name: "Actions for Sales" }).click();
  await page.getByRole("menuitem", { name: "Archive" }).click();
  await expect(page.getByRole("region", { name: "Archived" }).getByTestId("category-row")).toContainText("Sales");
});

test("owner creates an SOP with rich text, steps and attachments; autosave persists it", async ({ page }) => {
  await login(page, owner);
  await page.goto("/app/sops");
  await page.getByRole("link", { name: "New SOP" }).first().click();
  await page.getByLabel("Title").fill("Morning bake schedule");
  await page.getByLabel("Category").selectOption({ label: "Kitchen" });
  await page.getByLabel("Short description").fill("What goes in the oven before 6am.");
  await page.getByRole("button", { name: "Create and start writing" }).click();
  await expect(page).toHaveURL(/\/app\/sops\/[0-9a-f-]{36}\/edit$/);
  sopUrl = page.url().replace(/\/edit$/, "");

  // Rich text with formatting.
  const purpose = page.getByRole("textbox", { name: "Purpose" });
  await purpose.click();
  await page.keyboard.type("Fresh bread on the shelves by ");
  await page.getByRole("region", { name: "Purpose" }).getByRole("button", { name: "Bold" }).click();
  await page.keyboard.type("7am");
  await expect(purpose.locator("strong")).toHaveText("7am");
  const materials = page.getByRole("textbox", { name: "Required materials" });
  await materials.click();
  await page.getByRole("region", { name: "Required materials" }).getByRole("button", { name: "Checklist" }).click();
  await page.keyboard.type("Sourdough starter");

  // Steps, then reorder.
  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Step 1 title").fill("Weigh the flour");
  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Step 2 title").fill("Preheat ovens to 230°C");
  await page.getByTestId("step-editor").nth(1).getByLabel("Notes (optional)").fill("Both deck ovens");
  await page.getByRole("button", { name: "Move step 2 up" }).click();
  await expect(page.getByLabel("Step 1 title")).toHaveValue("Preheat ovens to 230°C");

  // Attachments (private storage).
  await page.getByLabel("Upload attachments").setInputFiles([
    { name: "oven-guide.pdf", mimeType: "application/pdf", buffer: PDF },
    { name: "tray-layout.png", mimeType: "image/png", buffer: PNG },
  ]);
  await expect(page.getByRole("region", { name: "Attachments" }).getByTestId("attachment")).toHaveCount(2);
  await page.getByTestId("step-editor").first().getByLabel("Image or file (optional)").selectOption({ label: "tray-layout.png" });

  await waitSaved(page);
  await page.reload();
  await expect(page.locator("#sop-title")).toHaveValue("Morning bake schedule");
  await expect(page.getByRole("textbox", { name: "Purpose" }).locator("strong")).toHaveText("7am");
  await expect(page.getByLabel("Step 1 title")).toHaveValue("Preheat ovens to 230°C");
  await expect(page.getByLabel("Step 2 title")).toHaveValue("Weigh the flour");
});

test("unsaved changes are never lost silently", async ({ page }) => {
  await login(page, owner);
  await page.goto(`${sopUrl}/edit`);
  await page.getByRole("textbox", { name: "Scope" }).click();
  await page.keyboard.type("All bakers on the early shift.");
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", /dirty|saving/);
  let prompted = false;
  page.once("dialog", (d) => {
    prompted = true;
    void d.dismiss();
  });
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Dashboard" }).click();
  // Either the save already finished, or the user was warned and stayed.
  if (prompted) await expect(page).toHaveURL(/\/edit$/);
  if (page.url().endsWith("/edit")) await waitSaved(page);
  await page.goto(`${sopUrl}/edit`);
  await waitSaved(page);
  await expect(page.getByRole("textbox", { name: "Scope" })).toContainText("All bakers on the early shift.");
});

test("drafts are invisible to members until published", async ({ page, browser }) => {
  const ctx = await browser.newContext();
  const m = await ctx.newPage();
  await login(m, member);
  await m.goto("/app/sops");
  await expect(m.getByText("No SOPs published yet")).toBeVisible();
  await expectNotFound(m, sopUrl);
  await ctx.close();

  // Owner turns on acknowledgment and publishes version 1.
  await login(page, owner);
  await page.goto(`${sopUrl}/edit`);
  await page.getByLabel("Require acknowledgment").check();
  await waitSaved(page);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Publish version 1" });
  await dialog.getByLabel(/revision note/).fill("First release");
  await dialog.getByRole("button", { name: "Publish" }).click();
  await expect(page).toHaveURL(new RegExp(`${sopUrl.split("/").pop()}$`));
  await expect(page.getByText("Version 1", { exact: true })).toBeVisible();
  const steps = page.getByTestId("step");
  await expect(steps.first()).toContainText("Preheat ovens to 230°C");
  await expect(steps.first()).toContainText("Both deck ovens");
  // Images go through the app gateway (access re-checked per request), never long-lived signed links.
  await expect(steps.first().locator("img")).toHaveAttribute("src", /^\/api\/sops\/attachments\/[0-9a-f-]{36}$/);
  await expect(page.locator('img[src*="/storage/v1/object/sign/"]')).toHaveCount(0);
});

test("members read, download attachments and acknowledge; owners see acknowledgment status", async ({ page, browser }) => {
  const ctx = await browser.newContext();
  const m = await ctx.newPage();
  await login(m, member);
  await expect(m.getByRole("button", { name: "Notifications, 1 unread" })).toBeVisible();
  await m.goto("/app/sops");
  await m.getByRole("link", { name: "Morning bake schedule" }).first().click();
  await expect(m.getByRole("heading", { name: "Morning bake schedule", level: 1 })).toBeVisible();
  await expect(m.getByRole("link", { name: "Edit" })).toHaveCount(0);

  // Attachments are served through the gateway, which redirects to a 30-second signed URL.
  const download = m.waitForEvent("download");
  await m.getByRole("button", { name: "Download oven-guide.pdf" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("oven-guide.pdf");
  const ownerClient = await supabaseAs(owner.email, owner.password);
  const { data: pdfRow } = await ownerClient.from("sop_attachments").select("id").eq("file_name", "oven-guide.pdf").single();
  pdfAttachmentId = pdfRow!.id;
  const viaGateway = await m.request.get(`/api/sops/attachments/${pdfAttachmentId}?download=1`, { maxRedirects: 0 });
  expect(viaGateway.status()).toBe(302);
  expect(viaGateway.headers()["location"]).toMatch(/\/storage\/v1\/object\/sign\/sop-attachments\/.+token=/);
  expect(viaGateway.headers()["cache-control"]).toContain("no-store");

  const card = m.getByTestId("ack-card").filter({ visible: true });
  await expect(card).toHaveAttribute("data-state", "pending");
  await card.getByRole("checkbox").check();
  await card.getByRole("button", { name: "Acknowledge" }).click();
  await expect(m.getByTestId("ack-card").filter({ visible: true })).toContainText("You acknowledged version 1");
  await ctx.close();

  await login(page, owner);
  await page.goto(sopUrl);
  const panel = page.getByTestId("acks-panel");
  await expect(panel).toContainText("1 of 2 acknowledged version 1");
  await expect(panel.getByTestId("ack-row").filter({ hasText: member.name })).toContainText("v1 ·");
  await expect(panel.getByTestId("ack-row").filter({ hasText: owner.name })).toContainText("Not acknowledged");
});

test("editing a published SOP keeps members on the published version until republished", async ({ page, browser }) => {
  await login(page, owner);
  await page.goto(`${sopUrl}/edit`);
  const purpose = page.getByRole("textbox", { name: "Purpose" });
  await purpose.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Croissants first.");
  await waitSaved(page);

  const ctx = await browser.newContext();
  const m = await ctx.newPage();
  await login(m, member);
  await m.goto(sopUrl);
  await expect(m.getByText("Croissants first.")).toHaveCount(0);

  await page.getByRole("button", { name: "Publish changes" }).click();
  await page.getByRole("dialog").getByLabel(/revision note/).fill("Croissants go in first");
  await page.getByRole("dialog").getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Version 2", { exact: true })).toBeVisible();

  await m.reload();
  await expect(m.getByText("Croissants first.").first()).toBeVisible();
  // An acknowledgment of v1 does not count for v2.
  await expect(m.getByTestId("ack-card").filter({ visible: true })).toContainText("You acknowledged version 1. This SOP has changed");
  await ctx.close();

  await page.reload();
  await expect(page.getByTestId("ack-row").filter({ hasText: member.name })).toContainText("Acknowledged v1 (outdated)");
});

test("version history: compare and restore as a new version", async ({ page }) => {
  await login(page, owner);
  await page.goto(`${sopUrl}/history`);
  await expect(page.getByTestId("version-item")).toHaveCount(2);
  await page.getByLabel("Compare with").selectOption("1");
  await page.getByRole("button", { name: "Compare" }).click();
  await expect(page.getByTestId("diff-field").filter({ hasText: "Purpose" })).toContainText("Croissants");

  await page.getByTestId("version-item").filter({ hasText: "Version 1" }).click();
  await page.getByRole("button", { name: "Restore" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Restore" }).click();
  await expect(page.getByTestId("version-item")).toHaveCount(3);
  await expect(page.getByTestId("version-item").first()).toContainText("Version 3");
  await expect(page.getByTestId("version-item").first()).toContainText("from v1");
  await page.goto(sopUrl);
  await expect(page.getByText("Croissants first.")).toHaveCount(0);
});

test("restricted SOPs are hidden from members without access", async ({ page, browser }) => {
  const ctx = await browser.newContext();
  const m = await ctx.newPage();
  await login(m, member);
  const fileUrl = `/api/sops/attachments/${pdfAttachmentId}`;
  expect((await m.request.get(fileUrl, { maxRedirects: 0 })).status()).toBe(302);

  await login(page, owner);
  await page.goto(`${sopUrl}/edit`);
  const access = page.getByRole("region", { name: "Who can see this SOP" });
  await access.getByText("Restricted", { exact: true }).click();
  await access.getByRole("button", { name: "Save access" }).click();
  await expect(access.getByRole("button", { name: "Access saved" })).toBeVisible();

  // Revocation is immediate: the same file link stops working on the next request.
  expect((await m.request.get(fileUrl, { maxRedirects: 0 })).status()).toBe(404);
  await expectNotFound(m, sopUrl);
  await m.goto("/app/sops");
  await expect(m.getByRole("link", { name: "Morning bake schedule" })).toHaveCount(0);

  await access.getByLabel("All members", { exact: true }).check();
  await access.getByRole("button", { name: "Save access" }).click();
  await expect(access.getByRole("button", { name: "Access saved" })).toBeVisible();
  await m.goto(sopUrl);
  await expect(m.getByRole("heading", { name: "Morning bake schedule", level: 1 })).toBeVisible();
  await ctx.close();
});

test("library: search, filter, sort, views, duplicate, archive and restore", async ({ page }) => {
  await login(page, owner);
  // A second, still-draft SOP in another category.
  await page.goto("/app/sops/new");
  await page.getByLabel("Title").fill("Allergen labelling");
  await page.getByLabel("Category").selectOption({ label: "Operations" });
  await page.getByRole("button", { name: "Create and start writing" }).click();
  await expect(page).toHaveURL(/\/edit$/);

  await page.goto("/app/sops");
  await expect(page.getByTestId("sop-row")).toHaveCount(2);
  await page.getByLabel("Search SOPs").fill("deck ovens");
  await expect(page.getByTestId("sop-row")).toHaveCount(1);
  await expect(page.getByTestId("sop-row")).toContainText("Morning bake schedule");
  await page.getByLabel("Search SOPs").fill("");
  await expect(page.getByTestId("sop-row")).toHaveCount(2);

  await page.getByLabel("Category").selectOption({ label: "Operations" });
  await expect(page.getByTestId("sop-row")).toHaveCount(1);
  await page.getByLabel("Category").selectOption({ label: "All categories" });
  await page.getByLabel("Status").selectOption({ label: "Drafts" });
  await expect(page.getByTestId("sop-row")).toHaveCount(1);
  await expect(page.getByTestId("sop-row")).toContainText("Allergen labelling");
  await page.getByLabel("Status").selectOption({ label: "Active (draft & published)" });

  await page.getByLabel("Sort by").selectOption("title");
  await expect(page.getByTestId("sop-row").first()).toContainText("Allergen labelling");
  await page.getByRole("button", { name: "Card view" }).click();
  await expect(page.getByTestId("sop-card")).toHaveCount(2);
  await page.getByRole("button", { name: "List view" }).click();

  await page.getByRole("button", { name: "Actions for Allergen labelling" }).click();
  await page.getByRole("menuitem", { name: "Duplicate" }).click();
  await expect(page).toHaveURL(/\/edit$/);
  await expect(page.locator("#sop-title")).toHaveValue("Copy of Allergen labelling");

  await page.goto("/app/sops");
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Actions for Copy of Allergen labelling" }).click();
  await page.getByRole("menuitem", { name: "Archive" }).click();
  await expect(page.getByTestId("sop-row").filter({ hasText: "Copy of Allergen labelling" })).toHaveCount(0);
  await page.getByLabel("Status").selectOption({ label: "Archived" });
  await expect(page.getByTestId("sop-row")).toHaveCount(1);
  await expect(page.getByTestId("sop-row")).toContainText("Copy of Allergen labelling");
  await page.getByRole("button", { name: "Actions for Copy of Allergen labelling" }).click();
  await page.getByRole("menuitem", { name: "Restore from archive" }).click();
  await expect(page.getByTestId("sop-row")).toHaveCount(0);
});

test("categories with SOPs can only be deleted after moving them", async ({ page }) => {
  await login(page, owner);
  await page.goto("/app/sops/categories");
  await page.getByRole("button", { name: "Actions for Kitchen" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Choose where to move them");
  await expect(dialog.getByRole("button", { name: "Move SOPs and delete" })).toBeDisabled();
  await dialog.getByLabel("Move SOPs to").selectOption({ label: "Operations" });
  await dialog.getByRole("button", { name: "Move SOPs and delete" }).click();
  await expect(page.getByTestId("category-row").filter({ hasText: "Kitchen" })).toHaveCount(0);
  await expect(page.getByTestId("category-row").filter({ hasText: "Operations" })).toContainText("3 SOPs");
});

test("global search finds SOPs by content and respects permissions", async ({ page, browser }) => {
  await login(page, owner);
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByLabel("Search query").fill("deck ovens");
  const hit = page.getByTestId("search-sop").filter({ hasText: "Morning bake schedule" });
  await expect(hit).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${sopUrl.split("/").pop()}$`));

  const ctx = await browser.newContext();
  const m = await ctx.newPage();
  await login(m, member);
  await m.getByRole("button", { name: "Search" }).click();
  await m.getByLabel("Search query").fill("Allergen");
  await expect(m.getByText(/Nothing in Harbor Bakery matches/)).toBeVisible();
  await ctx.close();

  const x = await browser.newContext();
  const o = await x.newPage();
  await login(o, outsider);
  await o.getByRole("button", { name: "Search" }).click();
  await o.getByLabel("Search query").fill("deck ovens");
  await expect(o.getByText(/Nothing in Stone Plumbing matches/)).toBeVisible();
  await expectNotFound(o, sopUrl);
  await x.close();
});

test("attachments are private: other workspaces get no access", async () => {
  const ownerClient = await supabaseAs(owner.email, owner.password);
  const { data: atts } = await ownerClient.from("sop_attachments").select("storage_path").eq("workspace_id", workspaceId);
  expect(atts!.length).toBeGreaterThan(0);
  const path = atts![0].storage_path;

  // The bucket is private: no public URL access.
  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/sop-attachments/${path}`;
  expect((await fetch(publicUrl)).status).toBeGreaterThanOrEqual(400);

  const outsiderClient = await supabaseAs(outsider.email, outsider.password);
  const { data: signed, error } = await outsiderClient.storage.from("sop-attachments").createSignedUrl(path, 60);
  expect(signed?.signedUrl ?? null).toBeNull();
  expect(error).not.toBeNull();
  const { data: rows } = await outsiderClient.from("sop_attachments").select("id").eq("workspace_id", workspaceId);
  expect(rows).toEqual([]);
});

test("dashboard shows real SOP data", async ({ page }) => {
  await login(page, owner);
  const widget = page.getByRole("region", { name: "Recent SOPs" });
  await expect(widget.getByTestId("sop-counts")).toContainText("Published");
  await expect(widget.getByTestId("recent-sop").filter({ hasText: "Morning bake schedule" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Quick Actions" }).getByRole("link", { name: "Create SOP" })).toHaveAttribute("href", "/app/sops/new");
  await expect(page.getByTestId("activity-item").filter({ hasText: "deleted the SOP category Kitchen" })).toBeVisible();
});
