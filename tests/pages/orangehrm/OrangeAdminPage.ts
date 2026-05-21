/**
 * OrangeAdminPage — /web/index.php/admin/viewSystemUsers
 * Demonstrates DataTableComponent on a real enterprise grid.
 */

import { Page, expect } from '@playwright/test';
import { BasePage } from '../BasePage';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';
import { DataTableComponent, SearchComponent, ButtonComponent, InputComponent, DropdownComponent } from '../../components';

export class OrangeAdminPage extends BasePage {

  // ─── Components ───────────────────────────────────────────────────────────

  readonly usersTable = new DataTableComponent(
    this.page, this.obs,
    { css: '.oxd-table' },
    'Users Table',
  );

  readonly searchUsernameInput = new InputComponent(
    this.page, this.obs,
    { css: '.oxd-form .oxd-input:first-of-type' },
    'Search Username',
  );

  readonly userRoleDropdown = new DropdownComponent(
    this.page, this.obs,
    { css: '.oxd-form .oxd-select-text:nth-of-type(1)' },
    'User Role', 'custom',
  );

  readonly searchButton = new ButtonComponent(
    this.page, this.obs,
    { css: 'button[type="submit"]' },
    'Search Button',
  );

  readonly addUserButton = new ButtonComponent(
    this.page, this.obs,
    { css: 'button.oxd-button--secondary' },
    'Add User Button',
  );

  constructor(page: Page, obs: ObservabilityCollector) {
    super(page, obs);
  }

  async open(): Promise<void> {
    await this.navigateTo(
      'https://opensource-demo.orangehrmlive.com/web/index.php/admin/viewSystemUsers',
      'ORANGE_ADMIN',
    );
  }

  async searchByUsername(username: string): Promise<void> {
    await this.searchUsernameInput.fill(username);
    await this.searchButton.clickAndWait();
    // Wait for table to reload
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async getUserRowCount(): Promise<number> {
    return this.page.locator('.oxd-table-body .oxd-table-row').count();
  }

  async getUsernameFromRow(rowIndex: number): Promise<string> {
    return (await this.page
      .locator('.oxd-table-body .oxd-table-row')
      .nth(rowIndex)
      .locator('.oxd-table-cell')
      .nth(1)
      .textContent() ?? '').trim();
  }

  async getRoleFromRow(rowIndex: number): Promise<string> {
    return (await this.page
      .locator('.oxd-table-body .oxd-table-row')
      .nth(rowIndex)
      .locator('.oxd-table-cell')
      .nth(2)
      .textContent() ?? '').trim();
  }

  // ─── Assertions ───────────────────────────────────────────────────────────

  async assertOnAdminPage(): Promise<void> {
    await this.assertUrl(/admin\/viewSystemUsers/);
    await expect(this.page.locator('.oxd-table')).toBeVisible();
  }

  async assertUserExists(username: string): Promise<void> {
    await this.searchByUsername(username);
    const count = await this.getUserRowCount();
    expect(count).toBeGreaterThan(0);
    const firstUser = await this.getUsernameFromRow(0);
    expect(firstUser.toLowerCase()).toContain(username.toLowerCase());
  }

  async assertTableHasRecords(): Promise<void> {
    const count = await this.getUserRowCount();
    expect(count).toBeGreaterThan(0);
  }

  async assertAddButtonVisible(): Promise<void> {
    await this.addUserButton.assertVisible();
  }
}
