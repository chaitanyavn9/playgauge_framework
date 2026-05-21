/**
 * SideBarComponent — models collapsible side navigation menus.
 *
 * Usage:
 *   const sidebar = new SideBarComponent(page, obs, { automationId: 'main-sidebar' });
 *   await sidebar.expand();
 *   await sidebar.clickItem('User Management');
 *   await sidebar.assertExpanded();
 */

import { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BaseComponent, LocatorStrategy } from '../base/BaseComponent';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';

export class SideBarComponent extends BaseComponent {
  constructor(
    page: Page,
    obs: ObservabilityCollector,
    strategy: LocatorStrategy,
    name?: string,
  ) {
    super(page, obs, strategy, name ?? 'SideBarComponent');
  }

  // ─── Expand / collapse ────────────────────────────────────────────────────

  async expand(): Promise<void> {
    if (await this.isCollapsed()) {
      await this.interact('expand', async () => {
        await this.root
          .locator('[automation-id="sidebar-toggle"], [aria-label="Expand sidebar"], button.sidebar-toggle')
          .first()
          .click();
      });
    }
  }

  async collapse(): Promise<void> {
    if (!await this.isCollapsed()) {
      await this.interact('collapse', async () => {
        await this.root
          .locator('[automation-id="sidebar-toggle"], [aria-label="Collapse sidebar"], button.sidebar-toggle')
          .first()
          .click();
      });
    }
  }

  async isCollapsed(): Promise<boolean> {
    const expanded = await this.root.getAttribute('aria-expanded');
    if (expanded !== null) return expanded === 'false';
    const className = await this.root.getAttribute('class') ?? '';
    return className.includes('collapsed') || className.includes('closed');
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  async clickItem(label: string): Promise<void> {
    await this.interact(`clickItem:${label}`, async () => {
      await this.root
        .locator(`a:has-text("${label}"), button:has-text("${label}"), [role="menuitem"]:has-text("${label}")`)
        .first()
        .click();
    });
  }

  async expandSection(sectionLabel: string): Promise<void> {
    await this.interact(`expandSection:${sectionLabel}`, async () => {
      const section = this.root
        .locator(`button:has-text("${sectionLabel}"), [role="button"]:has-text("${sectionLabel}")`)
        .first();
      const isExpanded = await section.getAttribute('aria-expanded');
      if (isExpanded !== 'true') await section.click();
    });
  }

  // ─── Read state ───────────────────────────────────────────────────────────

  async getMenuItems(): Promise<string[]> {
    return this.root
      .locator('a, [role="menuitem"]')
      .allTextContents()
      .then((items) => items.map((i) => i.trim()).filter(Boolean));
  }

  async getActiveItem(): Promise<string> {
    return (await this.root
      .locator('[aria-current="page"], .active, [data-active="true"]')
      .first()
      .textContent() ?? '').trim();
  }

  // ─── Assertions ───────────────────────────────────────────────────────────

  async assertExpanded(): Promise<void> {
    expect(await this.isCollapsed()).toBe(false);
  }

  async assertCollapsed(): Promise<void> {
    expect(await this.isCollapsed()).toBe(true);
  }

  async assertItemVisible(label: string): Promise<void> {
    await expect(
      this.root.locator(`a:has-text("${label}"), [role="menuitem"]:has-text("${label}")`).first(),
    ).toBeVisible();
  }

  async assertActiveItem(label: string): Promise<void> {
    const active = await this.getActiveItem();
    expect(active).toContain(label);
  }
}
