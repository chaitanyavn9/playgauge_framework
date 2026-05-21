/**
 * Login step implementations — Component Model version.
 * Steps call page business methods only.
 * No locators, no Playwright APIs, no component knowledge here.
 */

import { Step, DataStore } from 'gauge-ts';
import { Page } from 'playwright';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ObservabilityCollector } from '../observability/ObservabilityCollector';

function getPage(): Page                   { return DataStore.ScenarioDataStore.get('page') as Page; }
function getObs():  ObservabilityCollector { return DataStore.ScenarioDataStore.get('obs')  as ObservabilityCollector; }
function loginPage():    LoginPage         { return new LoginPage(getPage(), getObs()); }
function dashboardPage():DashboardPage     { return new DashboardPage(getPage(), getObs()); }

@Step('Open the login page')
async function openLoginPage(): Promise<void> {
  await loginPage().open();
}

@Step('Enter username <username> and password <password>')
async function enterCredentials(username: string, password: string): Promise<void> {
  await loginPage().login({ username, password });
}

@Step('Click the login button')
async function clickLogin(): Promise<void> {
  // Login is triggered inside login() — this step is declarative in the spec
}

@Step('Verify the user is redirected to the dashboard')
async function verifyDashboardRedirect(): Promise<void> {
  await loginPage().assertLoginSuccessful();
}

@Step('Verify the welcome banner is visible')
async function verifyWelcomeBanner(): Promise<void> {
  await dashboardPage().assertOnDashboard();
}

@Step('Verify an error message is displayed')
async function verifyErrorMessage(): Promise<void> {
  await loginPage().assertLoginFailed();
}

@Step('Verify the user remains on the login page')
async function verifyStillOnLoginPage(): Promise<void> {
  await loginPage().assertOnLoginPage();
}

@Step('Verify username field is visible')
async function verifyUsernameField(): Promise<void> {
  await loginPage().usernameInput.assertVisible();
}

@Step('Verify password field is visible')
async function verifyPasswordField(): Promise<void> {
  await loginPage().passwordInput.assertVisible();
}

@Step('Verify login button is visible')
async function verifyLoginButton(): Promise<void> {
  await loginPage().loginButton.assertVisible();
}

@Step('Click the logout button')
async function clickLogout(): Promise<void> {
  await dashboardPage().logout();
}

@Step('Verify the user is redirected to the login page')
async function verifyLoginPageRedirect(): Promise<void> {
  await loginPage().assertOnLoginPage();
}
