/**
 * OrangeDashboardPage — /web/index.php/dashboard/index
 * Composes NavBar, SideBar and other OrangeHRM-specific widgets.
 */

import { Page, expect } from '@playwright/test';
import { BasePage } from '../BasePage';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';
import { ButtonComponent, NavBarComponent } from '../../components';

export class OrangeDashboardPage extends BasePage {

  // ─── Components ───────────────────────────────────────────────────────────

  readonly topNav = new NavBarComponent(
    this.page, this.obs,
    { css: '.oxd-topbar' },
    'Top Nav',
  );

  readonly userDropdownToggle = new ButtonComponent(
    this.page, this.obs,
    { css: '.oxd-userdropdown-tab' },
    'User Dropdown',
  );

  readonly logoutButton = new ButtonComponent(
    this.page, this.obs,
    { css: '.oxd-userdropdown-link[href*="logout"]' },
    'Logout',
  );

  constructor(page: Page, obs: ObservabilityCollector) {
    super(page, obs);
  }

  // ─── Navigation helpers ───────────────────────────────────────────────────

  /** Click a top-level nav menu item e.g. "Admin", "PIM", "Leave" */
  async navigateToModule(moduleName: string): Promise<void> {
    const menuItem = this.page
      .locator('.oxd-main-menu-item')
      .filter({ hasText: moduleName })
      .first();
    await menuItem.waitFor({ state: 'visible' });
    await menuItem.click();
    await this.waitForPageReady();
  }

  async logout(): Promise<void> {
    await this.userDropdownToggle.click();
    await this.logoutButton.clickAndWait();
  }

  async getLoggedInUsername(): Promise<string> {
    return (await this.page
      .locator('.oxd-userdropdown-name')
      .textContent() ?? '').trim();
  }

  async getWidgetTitles(): Promise<string[]> {
    return this.page
      .locator('.oxd-grid-item .oxd-text--h6')
      .allTextContents()
      .then(titles => titles.map(t => t.trim()).filter(Boolean));
  }

  async getDashboardHeading(): Promise<string> {
    return (await this.page
      .locator('.oxd-topbar-header-breadcrumb h6')
      .textContent() ?? '').trim();
  }

  // ─── Assertions ───────────────────────────────────────────────────────────

  async assertOnDashboard(): Promise<void> {
    await this.assertUrl(/dashboard\/index/);
    await expect(this.page.locator('.oxd-topbar')).toBeVisible();
  }

  async assertLoggedInAs(username: string): Promise<void> {
    const name = await this.getLoggedInUsername();
    expect(name).toBe(username);
  }

  async assertModuleVisible(moduleName: string): Promise<void> {
    await expect(
      this.page.locator('.oxd-main-menu-item').filter({ hasText: moduleName }).first()
    ).toBeVisible();
  }

  async assertUserDropdownVisible(): Promise<void> {
    await this.userDropdownToggle.assertVisible();
  }
}
