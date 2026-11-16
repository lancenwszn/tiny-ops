import { expect, test } from "@playwright/test";
import { createWorkspace, emailLink, signIn, signUpAndVerify, supabaseAs, uniqueEmail } from "./helpers";

// Stage 1 critical journeys: auth, workspaces, isolation, invitations.
test.describe.configure({ mode: "serial" });

const owner = { name: "Ayesha Khan", email: uniqueEmail("owner"), password: "Organized123" };
const teammate = { name: "Sam Rivera", email: uniqueEmail("teammate"), password: "Teamwork456" };
let secondWorkspaceName = "";

test("protected routes redirect to login with a safe next parameter", async ({ page }) => {
  await page.goto("/app/settings");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fsettings/);
});

test("sign-up validates input", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("A");
  await page.getByLabel("Work email").fill("not-an-email");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter your full name")).toBeVisible();
  await expect(page.getByText("Enter a valid email address")).toBeVisible();
  await expect(page.getByText("Use at least 8 characters")).toBeVisible();
});

test("owner signs up, verifies email and creates a workspace", async ({ page }) => {
  await signUpAndVerify(page, owner);
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByRole("heading", { name: /Welcome, Ayesha/ })).toBeVisible();

  await createWorkspace(page, "Brightside Coffee", "Africa/Lagos");
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Ayesha/ })).toBeVisible();
  await expect(page.getByText("Growth trial")).toBeVisible();
  await expect(page.getByText(/Africa\/Lagos/)).toBeVisible();
  await expect(page.getByText(/days left in your free trial/).first()).toBeVisible();
});

test("unverified accounts cannot sign in", async ({ page }) => {
  const email = uniqueEmail("unverified");
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Not Verified");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill("Unverified123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email/);

  await signIn(page, email, "Unverified123");
  await expect(page.getByText(/verify your email address first/)).toBeVisible();
});

test("owner edits workspace settings, uploads a logo and updates profile", async ({ page }) => {
  await signIn(page, owner.email, owner.password);
  await expect(page).toHaveURL(/\/app\/dashboard/);

  await page.goto("/app/settings");
  await page.getByLabel("Business name").fill("Brightside Coffee Co.");
  await page.getByLabel("What does your business do?").fill("Two neighbourhood coffee shops.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Workspace settings saved.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Current workspace: Brightside Coffee Co\./ })).toBeVisible();

  // 1x1 PNG
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.getByLabel("Upload logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Logo updated")).toBeVisible();

  await page.goto("/app/settings/profile");
  await page.getByLabel("Full name").fill("Ayesha K. Khan");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();
});

test("owner creates a second workspace and switches between them", async ({ page }) => {
  await signIn(page, owner.email, owner.password);
  await expect(page).toHaveURL(/\/app\/dashboard/);
  await page.goto("/onboarding?new=1");
  secondWorkspaceName = "Brightside Catering";
  await createWorkspace(page, secondWorkspaceName);
  await expect(page.getByRole("button", { name: `Current workspace: ${secondWorkspaceName}. Switch workspace` })).toBeVisible();

  await page.getByRole("button", { name: /Switch workspace/ }).click();
  await page.getByRole("menuitem", { name: /Brightside Coffee Co\./ }).click();
  await expect(page.getByRole("button", { name: "Current workspace: Brightside Coffee Co.. Switch workspace" })).toBeVisible();

  await page.goto("/app/workspaces");
  await expect(page.getByText("Brightside Catering")).toBeVisible();
  await expect(page.getByText("Current")).toBeVisible();
});

test("open redirects through ?next= are blocked", async ({ page }) => {
  await signIn(page, owner.email, owner.password, "//evil.example.com");
  await expect(page).toHaveURL(/localhost:\d+\/app\/dashboard/);
});

test("teammate joins through an invitation and has member permissions", async ({ page }) => {
  // Owner creates an invitation through the RLS-protected RPC.
  const ownerClient = await supabaseAs(owner.email, owner.password);
  const { data: ws } = await ownerClient.from("workspaces").select("id, name").eq("name", "Brightside Coffee Co.").single();
  const { data: invite, error } = await ownerClient.rpc("create_invitation", {
    p_workspace_id: ws!.id,
    p_email: teammate.email,
    p_role: "member",
  });
  expect(error).toBeNull();
  const invitePath = `/invite/${invite![0].token}`;

  await page.goto(invitePath);
  await expect(page.getByRole("heading", { name: "Join Brightside Coffee Co." })).toBeVisible();
  await page.getByRole("link", { name: "Create account & join" }).click();
  await expect(page.getByLabel("Work email")).toHaveValue(teammate.email);

  await page.getByLabel("Full name").fill(teammate.name);
  await page.getByLabel("Password").fill(teammate.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email/);
  await page.goto(await emailLink(teammate.email, /Confirm your TinyOps account/));

  await expect(page).toHaveURL(new RegExp(invitePath));
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/);
  await expect(page.getByRole("region", { name: "Welcome" }).getByText("member", { exact: true })).toBeVisible();

  await page.goto("/app/settings");
  await expect(page.getByText("Only the workspace owner can change these settings.")).toBeVisible();
  await expect(page.getByLabel("Business name")).toBeDisabled();

  // The invitation link cannot be reused.
  await page.goto(invitePath);
  await expect(page.getByText("This invitation has already been accepted.")).toBeVisible();
});

test("a forged workspace cookie cannot open another business's workspace", async ({ page, context }) => {
  const ownerClient = await supabaseAs(owner.email, owner.password);
  const { data: other } = await ownerClient.from("workspaces").select("id").eq("name", secondWorkspaceName).single();

  await signIn(page, teammate.email, teammate.password);
  await expect(page).toHaveURL(/\/app\/dashboard/);

  await context.addCookies([{ name: "tinyops_ws", value: other!.id, url: page.url() }]);
  await page.goto("/app/dashboard");
  await expect(page.getByRole("button", { name: /Current workspace: Brightside Coffee Co\./ })).toBeVisible();
  await expect(page.getByText(secondWorkspaceName)).toHaveCount(0);

  // Direct API access is blocked by RLS too.
  const teammateClient = await supabaseAs(teammate.email, teammate.password);
  const { data } = await teammateClient.from("workspaces").select("id").eq("id", other!.id);
  expect(data).toEqual([]);
});

test("password reset by email", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(owner.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/we've sent a reset link/)).toBeVisible();

  await page.goto(await emailLink(owner.email, /Reset your TinyOps password/));
  await expect(page).toHaveURL(/\/reset-password/);
  owner.password = "Reorganized789";
  await page.getByLabel("New password", { exact: true }).fill(owner.password);
  await page.getByLabel("Confirm new password").fill(owner.password);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/);
  await expect(page.getByText("Your password has been updated.")).toBeVisible();
});

test("sign out ends the session", async ({ page }) => {
  await signIn(page, owner.email, owner.password);
  await expect(page).toHaveURL(/\/app\/dashboard/);
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/app/dashboard");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("wrong password shows a generic error", async ({ page }) => {
  await signIn(page, owner.email, "WrongPassword1");
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
});
