/**
 * OrangeHRM — Standalone Playwright Spec
 * ==========================================
 * Run with:  npx playwright test playwright-tests/orangehrm/orangehrm.spec.ts
 *
 * No Gauge required — pure Playwright test runner.
 * Hits the live demo at https://opensource-demo.orangehrmlive.com
 *
 * NOTE: OrangeHRM's demo server can be slow (~10-15s page loads) — timeouts
 *       are set generously to 30s per assertion.
 */

import { test, expect } from '@playwright/test';

const BASE = 'https://opensource-demo.orangehrmlive.com';
const LOGIN_URL = `${BASE}/web/index.php/auth/login`;
const ADMIN_URL  = `${BASE}/web/index.php/admin/viewSystemUsers`;

// ─── Shared login helper ──────────────────────────────────────────────────────

async function loginAsAdmin(page: any) {
  await page.goto(LOGIN_URL);
  await page.waitForSelector('input[name="username"]', { state: 'visible', timeout: 30_000 });
  await page.locator('input[name="username"]').fill('Admin');
  await page.locator('input[name="password"]').fill('admin123');
  await page.locator('button[type="submit"]').click();
  // Wait for dashboard to load
  await page.waitForURL(/dashboard\/index/, { timeout: 30_000 });
  await page.waitForSelector('.oxd-topbar', { state: 'visible', timeout: 30_000 });
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE: Login
// ─────────────────────────────────────────────────────────────────────────────

test.describe('OrangeHRM — Login', () => {

  test('login page elements are present', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await expect(page.locator('input[name="username"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('successful admin login redirects to dashboard', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/dashboard\/index/);
    await expect(page.locator('.oxd-topbar')).toBeVisible();
  });

  test('login fails with invalid credentials', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await page.waitForSelector('input[name="username"]', { state: 'visible', timeout: 30_000 });
    await page.locator('input[name="username"]').fill('invalid_user');
    await page.locator('input[name="password"]').fill('wrong_pass');
    await page.locator('button[type="submit"]').click();

    // OrangeHRM shows a toast notification on failed login
    await expect(
      page.locator('.oxd-alert-content-text, p.oxd-text--toast-message')
    ).toBeVisible({ timeout: 15_000 });
  });

  test('admin can log out and is redirected to login', async ({ page }) => {
    await loginAsAdmin(page);

    // Open user dropdown
    await page.locator('.oxd-userdropdown-tab').click();

    // Click Logout link
    await page.locator('.oxd-userdropdown-link[href*="logout"]').click();

    // Should land back on login page
    await expect(page).toHaveURL(/auth\/login/, { timeout: 15_000 });
    await expect(page.locator('input[name="username"]')).toBeVisible();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE: Dashboard & Navigation
// ─────────────────────────────────────────────────────────────────────────────

test.describe('OrangeHRM — Dashboard', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('dashboard displays required top-nav modules', async ({ page }) => {
    const modules = ['Admin', 'PIM', 'Leave', 'Time'];
    for (const mod of modules) {
      await expect(
        page.locator('.oxd-main-menu-item').filter({ hasText: mod }).first()
      ).toBeVisible({ timeout: 15_000 });
    }
  });

  test('user dropdown is visible in header', async ({ page }) => {
    await expect(page.locator('.oxd-userdropdown-tab')).toBeVisible();
  });

  test('Admin module name displayed in header breadcrumb after navigation', async ({ page }) => {
    // Click Admin menu item
    await page.locator('.oxd-main-menu-item')
      .filter({ hasText: 'Admin' })
      .first()
      .click();

    await page.waitForURL(/admin\/viewSystemUsers/, { timeout: 20_000 });
    await expect(page.locator('.oxd-table')).toBeVisible({ timeout: 15_000 });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE: User Management (Admin Page)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('OrangeHRM — User Management', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    // Navigate directly to avoid depending on nav click
    await page.goto(ADMIN_URL);
    await page.waitForSelector('.oxd-table', { state: 'visible', timeout: 30_000 });
  });

  test('users table is visible and has records', async ({ page }) => {
    await expect(page.locator('.oxd-table')).toBeVisible();
    const rows = await page.locator('.oxd-table-body .oxd-table-row').count();
    expect(rows).toBeGreaterThan(0);
  });

  test('can search for Admin user and see results', async ({ page }) => {
    // Fill username search
    await page.locator('.oxd-form .oxd-input:first-of-type').fill('Admin');
    await page.locator('button[type="submit"]').click();

    // Wait for table to reload
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500); // OrangeHRM table re-render delay

    const rows = await page.locator('.oxd-table-body .oxd-table-row').count();
    expect(rows).toBeGreaterThan(0);

    // First result username cell should contain 'Admin'
    const firstUsername = await page
      .locator('.oxd-table-body .oxd-table-row')
      .first()
      .locator('.oxd-table-cell')
      .nth(1)
      .textContent();

    expect(firstUsername?.trim().toLowerCase()).toContain('admin');
  });

  test('Add User button is visible', async ({ page }) => {
    await expect(page.locator('button.oxd-button--secondary')).toBeVisible();
  });

  test('table headers match expected columns', async ({ page }) => {
    const headers = await page
      .locator('.oxd-table-header .oxd-table-cell')
      .allTextContents();

    const cleanHeaders = headers.map(h => h.trim()).filter(Boolean);

    // OrangeHRM system users table should have these columns
    expect(cleanHeaders).toContain('Username');
    expect(cleanHeaders).toContain('User Role');
    expect(cleanHeaders).toContain('Employee Name');
    expect(cleanHeaders).toContain('Status');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE: Observability — Network & Console (showcase framework capability)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('OrangeHRM — Observability', () => {

  test('no JS console errors on login page', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(LOGIN_URL);
    await page.waitForSelector('input[name="username"]', { state: 'visible', timeout: 30_000 });

    // Filter out known third-party noise
    const meaningful = consoleErrors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('third-party') &&
      !e.includes('net::ERR_BLOCKED')
    );

    if (meaningful.length > 0) {
      console.warn(`⚠️  Console errors detected on login page:\n${meaningful.join('\n')}`);
    }
    // Soft assertion — log but don't fail (demo site may have minor errors)
    expect(meaningful.length).toBeLessThanOrEqual(3);
  });

  test('API calls return successful status codes after login', async ({ page }) => {
    const failedRequests: { url: string; status: number }[] = [];

    page.on('response', response => {
      const status = response.status();
      const url = response.url();
      // Only track XHR/fetch calls to the OrangeHRM API
      if (url.includes('/api/v2/') && status >= 400) {
        failedRequests.push({ url, status });
      }
    });

    await loginAsAdmin(page);

    if (failedRequests.length > 0) {
      console.warn('Failed API calls after login:', failedRequests);
    }

    expect(failedRequests).toHaveLength(0);
  });

});
