/**
 * OrangeLoginPage — https://opensource-demo.orangehrmlive.com
 * OrangeHRM uses standard CSS selectors + some attribute-based selectors.
 */

import { Page } from '@playwright/test';
import { BasePage } from '../BasePage';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';
import { InputComponent, ButtonComponent, AlertComponent } from '../../components';

export class OrangeLoginPage extends BasePage {

  // ─── Components ───────────────────────────────────────────────────────────

  readonly usernameInput = new InputComponent(
    this.page, this.obs,
    { css: 'input[name="username"]' },
    'Username',
  );

  readonly passwordInput = new InputComponent(
    this.page, this.obs,
    { css: 'input[name="password"]' },
    'Password',
  );

  readonly loginButton = new ButtonComponent(
    this.page, this.obs,
    { css: 'button[type="submit"]' },
    'Login Button',
  );

  readonly errorAlert = new AlertComponent(
    this.page, this.obs,
    { css: '.oxd-alert-content-text, p.oxd-text--toast-message' },
    'Login Error',
  );

  constructor(page: Page, obs: ObservabilityCollector) {
    super(page, obs);
  }

  async open(): Promise<void> {
    await this.navigateTo(
      'https://opensource-demo.orangehrmlive.com/web/index.php/auth/login',
      'ORANGE_LOGIN',
    );
  }

  async loginAs(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.clickAndWait();
  }

  async loginAsAdmin(): Promise<void> {
    await this.loginAs('Admin', 'admin123');
  }

  // ─── Assertions ───────────────────────────────────────────────────────────

  async assertOnLoginPage(): Promise<void> {
    await this.assertUrl(/auth\/login/);
    await this.usernameInput.assertVisible();
  }

  async assertLoginSuccessful(): Promise<void> {
    await this.assertUrl(/dashboard\/index/, );
    await this.page.waitForSelector('.oxd-topbar', { state: 'visible', timeout: 15_000 });
  }

  async assertLoginFailed(): Promise<void> {
    // OrangeHRM shows a toast notification on failed login
    await this.page.waitForSelector(
      '.oxd-alert-content-text, p.oxd-text--toast-message',
      { state: 'visible', timeout: 8_000 },
    );
  }

  async assertErrorMessage(expected: string): Promise<void> {
    await this.page.waitForSelector('.oxd-alert-content-text', { state: 'visible' });
    const { expect } = await import('@playwright/test');
    await expect(this.page.locator('.oxd-alert-content-text')).toContainText(expected);
  }
}
