import { expect, test } from "@playwright/test";

test("registers, creates a household, and adds a manual item", async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  await page.goto("/welcome");
  await page.getByLabel("Your name").fill("E2E User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });
  await page.getByLabel("Household name").fill("E2E Household");
  await page.getByRole("button", { name: "Create household" }).click();
  await expect(page.getByRole("button", { name: "Go to my kitchen" })).toBeVisible();
  await page.getByRole("button", { name: "Go to my kitchen" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("E2E Household").first()).toBeVisible();

  await page.goto("/scan?tab=manual");
  await page.getByLabel(/^Name/).fill("E2E Milk");
  await page.getByLabel("Date", { exact: true }).fill("2026-12-31");
  await page.getByLabel("Date type").selectOption("use_by");
  await page.getByRole("button", { name: "Save to my food" }).click();

  await expect(page).toHaveURL(/\/food/, { timeout: 20_000 });
  await expect(page.getByText("E2E Milk")).toBeVisible();
  await expect(page.getByText(/Use by/).first()).toBeVisible();
});

test("rejects invalid registration input", async ({ page }) => {
  await page.goto("/welcome");
  await page.getByLabel("Your name").fill("A");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});
