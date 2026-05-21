/**
 * BasePage (Component Model version)
 *
 * Pages no longer own any locators directly.
 * All UI knowledge lives in components.
 * BasePage provides:
 *  - Navigation helpers
 *  - Screenshot utilities
 *  - URL assertions
 *  - Access to shared env + obs
 */

import { Page, expect } from '@playwright/test';
import { ObservabilityCollector } from '../observability/ObservabilityCollector';
import { EnvLoader, FrameworkEnv } from '../utils/EnvLoader';
import { logger } from '../utils/Logger';

export abstract class BasePage {
  protected readonly page: Page;
  protected readonly obs:  ObservabilityCollector;
  protected readonly env:  FrameworkEnv;

  constructor(page: Page, obs: ObservabilityCollector) {
    this.page = page;
    this.obs  = obs;
    this.env  = EnvLoader.load();
  }

  // ─── Navigation ──────────────────────────────────────────────────────────

  protected async navigateTo(url: string, pageLabel: string): Promise<void> {
    logger.info(`Navigating to [${pageLabel}]: ${url}`);
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    this.obs.setCurrentPage(pageLabel);
    await this.waitForPageReady();
  }

  protected async waitForPageReady(timeout = 10_000): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout }).catch(() => {
      logger.warn('networkidle timeout — continuing');
    });
  }

  protected buildUrl(path: string): string {
    const base = this.env.port
      ? `${this.env.baseURL}:${this.env.port}`
      : this.env.baseURL;
    return `${base}${path}`;
  }

  // ─── URL assertions ───────────────────────────────────────────────────────

  async assertUrl(pattern: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(pattern);
  }

  async assertUrlContains(path: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(path.replace(/\//g, '\\/')));
  }

  currentUrl(): string {
    return this.page.url();
  }

  // ─── Title ────────────────────────────────────────────────────────────────

  async getTitle(): Promise<string> {
    return this.page.title();
  }

  async assertTitle(expected: string | RegExp): Promise<void> {
    await expect(this.page).toHaveTitle(expected);
  }

  // ─── Screenshots ─────────────────────────────────────────────────────────

  async takeScreenshot(name: string): Promise<Buffer> {
    const buf = await this.page.screenshot({ fullPage: true });
    logger.info(`Screenshot: ${name}`);
    return buf;
  }

  async takeFailureScreenshot(testName: string): Promise<Buffer> {
    return this.takeScreenshot(`FAIL_${testName}_${Date.now()}`);
  }
}
