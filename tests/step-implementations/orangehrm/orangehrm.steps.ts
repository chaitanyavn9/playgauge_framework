/**
 * OrangeHRM step implementations
 */

import { Step, DataStoreFactory } from 'gauge-ts';
import { Page } from 'playwright';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';
import { OrangeLoginPage }     from '../../pages/orangehrm/OrangeLoginPage';
import { OrangeDashboardPage } from '../../pages/orangehrm/OrangeDashboardPage';
import { OrangeAdminPage }     from '../../pages/orangehrm/OrangeAdminPage';

export class OrangeHRMSteps {

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private getPage(): Page                   { return DataStoreFactory.getScenarioDataStore().get('page') as Page; }
  private getObs():  ObservabilityCollector { return DataStoreFactory.getScenarioDataStore().get('obs')  as ObservabilityCollector; }

  private loginPage():     OrangeLoginPage     { return new OrangeLoginPage(this.getPage(), this.getObs()); }
  private dashboardPage(): OrangeDashboardPage { return new OrangeDashboardPage(this.getPage(), this.getObs()); }
  private adminPage():     OrangeAdminPage     { return new OrangeAdminPage(this.getPage(), this.getObs()); }

  // ─── Navigation ──────────────────────────────────────────────────────────────

  @Step('Open OrangeHRM login page')
  async openOrangeLogin(): Promise<void> {
    await this.loginPage().open();
  }

  // ─── Login ───────────────────────────────────────────────────────────────────

  @Step('Login to OrangeHRM as <username> with password <password>')
  async loginToOrangeHRM(username: string, password: string): Promise<void> {
    await this.loginPage().loginAs(username, password);
  }

  @Step('Verify OrangeHRM dashboard is loaded')
  async verifyOrangeDashboardLoaded(): Promise<void> {
    await this.loginPage().assertLoginSuccessful();
    await this.dashboardPage().assertOnDashboard();
  }

  @Step('Verify OrangeHRM login error is shown')
  async verifyOrangeLoginError(): Promise<void> {
    await this.loginPage().assertLoginFailed();
  }

  @Step('Verify OrangeHRM username field is visible')
  async verifyOrangeUsernameVisible(): Promise<void> {
    await this.loginPage().usernameInput.assertVisible();
  }

  @Step('Verify OrangeHRM password field is visible')
  async verifyOrangePasswordVisible(): Promise<void> {
    await this.loginPage().passwordInput.assertVisible();
  }

  @Step('Verify OrangeHRM login button is visible')
  async verifyOrangeLoginButtonVisible(): Promise<void> {
    await this.loginPage().loginButton.assertVisible();
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────

  @Step('Logout from OrangeHRM')
  async logoutFromOrangeHRM(): Promise<void> {
    await this.dashboardPage().logout();
  }

  @Step('Verify redirected to OrangeHRM login page')
  async verifyRedirectedToOrangeLogin(): Promise<void> {
    await this.loginPage().assertOnLoginPage();
  }

  // ─── Dashboard & Navigation ──────────────────────────────────────────────────

  @Step('Verify module <moduleName> is visible in nav')
  async verifyModuleVisibleInNav(moduleName: string): Promise<void> {
    await this.dashboardPage().assertModuleVisible(moduleName);
  }

  @Step('Verify user dropdown is visible')
  async verifyUserDropdownVisible(): Promise<void> {
    await this.dashboardPage().assertUserDropdownVisible();
  }

  @Step('Navigate to OrangeHRM module <moduleName>')
  async navigateToOrangeModule(moduleName: string): Promise<void> {
    await this.dashboardPage().navigateToModule(moduleName);
  }

  // ─── Admin / User Management ─────────────────────────────────────────────────

  @Step('Verify on OrangeHRM Admin user management page')
  async verifyOnOrangeAdminPage(): Promise<void> {
    await this.adminPage().assertOnAdminPage();
  }

  @Step('Verify users table has records')
  async verifyUsersTableHasRecords(): Promise<void> {
    await this.adminPage().assertTableHasRecords();
  }

  @Step('Search for user <username> in admin page')
  async searchForUserInAdminPage(username: string): Promise<void> {
    await this.adminPage().searchByUsername(username);
  }

  @Step('Verify user <username> exists in search results')
  async verifyUserExistsInSearchResults(username: string): Promise<void> {
    await this.adminPage().assertUserExists(username);
  }
}
