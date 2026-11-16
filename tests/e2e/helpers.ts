import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const uniqueEmail = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

/** Polls Mailpit for the newest email to `to` whose subject matches, and returns its first TinyOps link. */
export async function emailLink(to: string, subject: RegExp, linkPart = "/auth/confirm"): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const data = (await res.json()) as { messages: { ID: string; Subject: string }[] };
    const msg = data.messages.find((m) => subject.test(m.Subject));
    if (msg) {
      const full = (await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json()) as { HTML: string };
      const href = [...full.HTML.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replaceAll("&amp;", "&")).find((h) => h.includes(linkPart));
      if (href) return href;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email "${subject}" for ${to}`);
}

export async function signUpAndVerify(page: Page, opts: { name: string; email: string; password: string; next?: string }) {
  await page.goto(opts.next ? `/signup?next=${encodeURIComponent(opts.next)}` : "/signup");
  await page.getByLabel("Full name").fill(opts.name);
  await page.getByLabel("Work email").fill(opts.email);
  await page.getByLabel("Password").fill(opts.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email/);
  const link = await emailLink(opts.email, /Confirm your TinyOps account/);
  await page.goto(link);
}

export async function signIn(page: Page, email: string, password: string, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function createWorkspace(page: Page, name: string, timezone = "Europe/London") {
  await page.getByLabel("Business name").fill(name);
  await page.getByLabel("Timezone").selectOption(timezone);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/);
}

/** A Supabase client signed in as a user (for setting up data through RLS-protected RPCs). */
export async function supabaseAs(email: string, password: string) {
  const client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}
