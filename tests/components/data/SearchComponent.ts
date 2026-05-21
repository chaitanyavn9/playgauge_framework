/**
 * SearchComponent — models a search bar with optional results dropdown.
 *
 * Usage:
 *   const search = new SearchComponent(page, obs, { automationId: 'global-search' });
 *   await search.search('John Doe');
 *   await search.assertResultCount(3);
 *   await search.selectResult('John Doe');
 */

import { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BaseComponent, LocatorStrategy } from '../base/BaseComponent';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';

export class SearchComponent extends BaseComponent {
  constructor(
    page: Page,
    obs: ObservabilityCollector,
    strategy: LocatorStrategy,
    name?: string,
  ) {
    super(page, obs, strategy, name ?? 'SearchComponent');
  }

  async search(query: string): Promise<void> {
    await this.interact(`search:${query}`, async () => {
      const input = this.root.locator('input[type="search"], input[type="text"], input').first();
      await input.clear();
      await input.fill(query);
      // Many search components auto-trigger; optionally press Enter
      await this.page.waitForTimeout(300); // debounce wait
    });
  }

  async searchAndSubmit(query: string): Promise<void> {
    await this.search(query);
    await this.root.locator('input').first().press('Enter');
  }

  async clearSearch(): Promise<void> {
    await this.interact('clearSearch', async () => {
      const clearBtn = this.root.locator('[automation-id="search-clear"], [aria-label="Clear search"], button.clear').first();
      const isVisible = await clearBtn.isVisible().catch(() => false);
      if (isVisible) {
        await clearBtn.click();
      } else {
        await this.root.locator('input').first().clear();
      }
    });
  }

  async getResults(): Promise<string[]> {
    await this.root
      .locator('[role="listbox"], [automation-id="search-results"], .search-results')
      .first()
      .waitFor({ state: 'visible', timeout: 5_000 })
      .catch(() => {});
    return this.root
      .locator('[role="option"], [automation-id^="search-result-"], .search-result-item')
      .allTextContents();
  }

  async selectResult(text: string): Promise<void> {
    await this.interact(`selectResult:${text}`, async () => {
      await this.root
        .locator(`[role="option"]:has-text("${text}"), .search-result-item:has-text("${text}")`)
        .first()
        .click();
    });
  }

  async assertResultCount(expected: number): Promise<void> {
    const results = await this.getResults();
    expect(results).toHaveLength(expected);
  }

  async assertResultContains(text: string): Promise<void> {
    const results = await this.getResults();
    expect(results.some((r) => r.includes(text))).toBeTruthy();
  }

  async assertNoResults(): Promise<void> {
    const emptyState = this.root.locator(
      '[automation-id="search-empty"], .no-results, [data-empty="true"]',
    ).first();
    await expect(emptyState).toBeVisible();
  }
}
