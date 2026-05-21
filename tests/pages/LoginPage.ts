/**
 * LoginPage — Component Model version.
 *
 * This page owns ZERO locator strings.
 * It instantiates components and exposes business-level methods.
 * New team members understand the page purely from component names.
 */

import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { ObservabilityCollector } from '../observability/ObservabilityCollector';
import {
  InputComponent,
  ButtonComponent,
  AlertComponent,
} from '../components';

export interface LoginCredentials {
  username: string;
  password: string;
}

export class LoginPage extends BasePage {

  // ─── Component declarations ───────────────────────────────────────────────
  // These are the ONLY things this page knows about — component IDs.
  // No CSS, no XPath, no raw selectors anywhere in this file.

  readonly usernameInput = new InputComponent(
    this.page, this.obs, { automationId: 'login-username' }, 'Username Input',
  );

  readonly passwordInput = new InputComponent(
    this.page, this.obs, { automationId: 'login-password' }, 'Password Input',
  );

  readonly loginButton = new ButtonComponent(
    this.page, this.obs, { automationId: 'login-submit' }, 'Login Button',
  );

  readonly errorAlert = new AlertComponent(
    this.page, this.obs, { automationId: 'login-error' }, 'Login Error Alert',
  );

  // ─── Business methods ─────────────────────────────────────────────────────

  constructor(page: Page, obs: ObservabilityCollector) {
    super(page, obs);
  }

  async open(): Promise<void> {
    await this.navigateTo(this.buildUrl(this.env.pageLogin), 'LOGIN');
  }

  async login(credentials: LoginCredentials): Promise<void> {
    await this.usernameInput.fill(credentials.username);
    await this.passwordInput.fill(credentials.password);
    await this.loginButton.clickAndWait();
  }

  async loginWithDefaultCredentials(): Promise<void> {
    await this.login({
      username: this.env.username,
      password: this.env.password,
    });
  }

  // ─── Assertions ───────────────────────────────────────────────────────────

  async assertOnLoginPage(): Promise<void> {
    await this.assertUrlContains(this.env.pageLogin);
    await this.usernameInput.assertVisible();
    await this.passwordInput.assertVisible();
    await this.loginButton.assertVisible();
  }

  async assertLoginSuccessful(): Promise<void> {
    await this.assertUrlContains(this.env.pageDashboard);
  }

  async assertLoginFailed(expectedError?: string): Promise<void> {
    await this.errorAlert.assertVisible();
    if (expectedError) {
      await this.errorAlert.assertMessage(expectedError);
    }
  }

  async assertErrorNotVisible(): Promise<void> {
    await this.errorAlert.assertHidden();
  }

  async getErrorMessage(): Promise<string> {
    return this.errorAlert.getMessage();
  }
}
