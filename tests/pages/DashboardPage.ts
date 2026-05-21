/**
 * DashboardPage — Component Model version.
 *
 * Composes NavBar, SideBar, DataTable, Search, and Toast.
 * Zero raw locators — purely component orchestration + business logic.
 */

import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { ObservabilityCollector } from '../observability/ObservabilityCollector';
import {
  NavBarComponent,
  SideBarComponent,
  DataTableComponent,
  SearchComponent,
  ToastComponent,
  ButtonComponent,
} from '../components';

export class DashboardPage extends BasePage {

  // ─── Component declarations ───────────────────────────────────────────────

  readonly navBar = new NavBarComponent(
    this.page, this.obs, { automationId: 'top-nav' }, 'Top Nav',
  );

  readonly sideBar = new SideBarComponent(
    this.page, this.obs, { automationId: 'main-sidebar' }, 'Sidebar',
  );

  readonly activityTable = new DataTableComponent(
    this.page, this.obs, { automationId: 'dashboard-activity-table' }, 'Activity Table',
  );

  readonly globalSearch = new SearchComponent(
    this.page, this.obs, { automationId: 'global-search' }, 'Global Search',
  );

  readonly toast = new ToastComponent(
    this.page, this.obs, { css: '[data-toast], .toast-container .toast' }, 'Toast',
  );

  readonly logoutButton = new ButtonComponent(
    this.page, this.obs, { automationId: 'nav-logout' }, 'Logout Button',
  );

  // ─── Business methods ─────────────────────────────────────────────────────

  constructor(page: Page, obs: ObservabilityCollector) {
    super(page, obs);
  }

  async open(): Promise<void> {
    await this.navigateTo(this.buildUrl(this.env.pageDashboard), 'DASHBOARD');
  }

  async navigateTo_Section(section: string): Promise<void> {
    await this.sideBar.expand();
    await this.sideBar.clickItem(section);
    await this.waitForPageReady();
  }

  async logout(): Promise<void> {
    await this.logoutButton.clickAndWait();
  }

  async searchFor(query: string): Promise<void> {
    await this.globalSearch.search(query);
  }

  // ─── Assertions ───────────────────────────────────────────────────────────

  async assertOnDashboard(): Promise<void> {
    await this.assertUrlContains(this.env.pageDashboard);
    await this.navBar.assertVisible();
  }

  async assertWelcomeToastVisible(): Promise<void> {
    await this.toast.waitForToast();
  }

  async assertNavItemActive(label: string): Promise<void> {
    await this.navBar.assertActiveItem(label);
  }

  async assertSidebarVisible(): Promise<void> {
    await this.sideBar.assertVisible();
  }

  async assertActivityTableHasRows(): Promise<void> {
    const count = await this.activityTable.getRowCount();
    const { expect } = await import('@playwright/test');
    expect(count).toBeGreaterThan(0);
  }
}
