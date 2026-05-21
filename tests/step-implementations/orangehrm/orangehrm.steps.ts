/**
 * OrangeHRM step implementations
 *
 * Covers all steps defined in:
 *   specs/orangehrm/login.md
 *   specs/orangehrm/dashboard.md
 *
 * Pages used (Component-Model design — zero raw locators here):
 *   OrangeLoginPage   — login form + assertions
 *   OrangeDashboardPage — top-nav, modules, user-dropdown, logout
 *   OrangeAdminPage    — user management table + search
 */

import { Step, DataStore } from 'gauge-ts';
import { Page } from 'playwright';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';
import { OrangeLoginPage }     from '../../pages/orangehrm/OrangeLoginPage';
import { OrangeDashboardPage } from '../../pages/orangehrm/OrangeDashboardPage';
import { OrangeAdminPage }     from '../../pages/orangehrm/OrangeAdminPage';

// ─── Helpers — same pattern as saucedemo.steps.ts ─────────────────────────────

function getPage(): Page                   { return DataStore.ScenarioDataStore.get('page') as Page; }
function getObs():  ObservabilityCollector { return DataStore.ScenarioDataStore.get('obs')  as ObservabilityCollector; }

function loginPage():     OrangeLoginPage     { return new OrangeLoginPage(getPage(), getObs()); }
function dashboardPage(): OrangeDashboardPage { return new OrangeDashboardPage(getPage(), getObs()); }
function adminPage():     OrangeAdminPage     { return new OrangeAdminPage(getPage(), getObs()); }

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

@Step('Open OrangeHRM login page')
async function openOrangeLogin(): Promise<void> {
  await loginPage().open();
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────────

@Step('Login to OrangeHRM as <username> with password <password>')
async function loginToOrangeHRM(username: string, password: string): Promise<void> {
  await loginPage().loginAs(username, password);
}

@Step('Verify OrangeHRM dashboard is loaded')
async function verifyOrangeDashboardLoaded(): Promise<void> {
  await loginPage().assertLoginSuccessful();
  await dashboardPage().assertOnDashboard();
}

@Step('Verify OrangeHRM login error is shown')
async function verifyOrangeLoginError(): Promise<void> {
  await loginPage().assertLoginFailed();
}

@Step('Verify OrangeHRM username field is visible')
async function verifyOrangeUsernameVisible(): Promise<void> {
  await loginPage().usernameInput.assertVisible();
}

@Step('Verify OrangeHRM password field is visible')
async function verifyOrangePasswordVisible(): Promise<void> {
  await loginPage().passwordInput.assertVisible();
}

@Step('Verify OrangeHRM login button is visible')
async function verifyOrangeLoginButtonVisible(): Promise<void> {
  await loginPage().loginButton.assertVisible();
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────────────────────

@Step('Logout from OrangeHRM')
async function logoutFromOrangeHRM(): Promise<void> {
  await dashboardPage().logout();
}

@Step('Verify redirected to OrangeHRM login page')
async function verifyRedirectedToOrangeLogin(): Promise<void> {
  await loginPage().assertOnLoginPage();
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD & NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

@Step('Verify module <moduleName> is visible in nav')
async function verifyModuleVisibleInNav(moduleName: string): Promise<void> {
  await dashboardPage().assertModuleVisible(moduleName);
}

@Step('Verify user dropdown is visible')
async function verifyUserDropdownVisible(): Promise<void> {
  await dashboardPage().assertUserDropdownVisible();
}

@Step('Navigate to OrangeHRM module <moduleName>')
async function navigateToOrangeModule(moduleName: string): Promise<void> {
  await dashboardPage().navigateToModule(moduleName);
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN / USER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

@Step('Verify on OrangeHRM Admin user management page')
async function verifyOnOrangeAdminPage(): Promise<void> {
  await adminPage().assertOnAdminPage();
}

@Step('Verify users table has records')
async function verifyUsersTableHasRecords(): Promise<void> {
  await adminPage().assertTableHasRecords();
}

@Step('Search for user <username> in admin page')
async function searchForUserInAdminPage(username: string): Promise<void> {
  await adminPage().searchByUsername(username);
}

@Step('Verify user <username> exists in search results')
async function verifyUserExistsInSearchResults(username: string): Promise<void> {
  await adminPage().assertUserExists(username);
}
