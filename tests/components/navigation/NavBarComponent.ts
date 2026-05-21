/**
 * NavBarComponent — models the top navigation bar.
 *
 * Usage:
 *   const nav = new NavBarComponent(page, obs, { automationId: 'top-nav' });
 *   await nav.clickMenuItem('Reports');
 *   await nav.assertActiveItem('Dashboard');
 */

import { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BaseComponent, LocatorStrategy } from '../base/BaseComponent';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';

export class NavBarComponent extends BaseComponent {
  constructor(
    page: Page,
    obs: ObservabilityCollector,
    strategy: LocatorStrategy,
    name?: string,
  ) {
    super(page, obs, strategy, name ?? 'NavBarComponent');
  }

  async clickMenuItem(label: string): Promise<void> {
    await this.interact(`clickMenuItem:${label}`, async () => {
      await this.root
        .locator(`a:has-text("${label}"), button:has-text("${label}"), [role="menuitem"]:has-text("${label}")`)
        .first()
        .click();
    });
  }

  async getMenuItems(): Promise<string[]> {
    return this.root
      .locator('a, button, [role="menuitem"]')
      .allTextContents()
      .then((items) => items.map((i) => i.trim()).filter(Boolean));
  }

  async getActiveItem(): Promise<string> {
    return (await this.root
      .locator('[aria-current="page"], .active, [data-active="true"]')
      .first()
      .textContent() ?? '').trim();
  }

  async isMenuItemVisible(label: string): Promise<boolean> {
    return this.root
      .locator(`a:has-text("${label}"), button:has-text("${label}")`)
      .first()
      .isVisible();
  }

  async assertActiveItem(label: string): Promise<void> {
    const active = await this.getActiveItem();
    expect(active).toContain(label);
  }

  async assertMenuItemExists(label: string): Promise<void> {
    expect(await this.isMenuItemVisible(label)).toBe(true);
  }

  async assertMenuItemCount(expected: number): Promise<void> {
    const items = await this.getMenuItems();
    expect(items).toHaveLength(expected);
  }
}
