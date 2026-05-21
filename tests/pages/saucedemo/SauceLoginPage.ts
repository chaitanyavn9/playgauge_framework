/**
 * SauceLoginPage — https://www.saucedemo.com
 *
 * SauceDemo uses `data-test` attributes (not automation-id).
 * We use { css: '[data-test="..."]' } strategy in our components.
 * This is a perfect real-world example of the framework's flexibility.
 */

import { Page } from '@playwright/test';
import { BasePage } from '../BasePage';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';
import { InputComponent, ButtonComponent, AlertComponent } from '../../components';

export class SauceLoginPage extends BasePage {

  // ─── Components — wired to SauceDemo's actual data-test attributes ────────

  readonly usernameInput = new InputComponent(
    this.page, this.obs,
    { css: '[data-test="username"]' },
    'Username',
  );

  readonly passwordInput = new InputComponent(
    this.page, this.obs,
    { css: '[data-test="password"]' },
    'Password',
  );

  readonly loginButton = new ButtonComponent(
    this.page, this.obs,
    { css: '[data-test="login-button"]' },
    'Login Button',
  );

  readonly errorMessage = new AlertComponent(
    this.page, this.obs,
    { css: '[data-test="error"]' },
    'Error Message',
  );

  constructor(page: Page, obs: ObservabilityCollector) {
    super(page, obs);
  }

  // ─── Business methods ─────────────────────────────────────────────────────

  async open(): Promise<void> {
    await this.navigateTo('https://www.saucedemo.com', 'SAUCE_LOGIN');
  }

  async loginAs(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.clickAndWait();
  }

  async loginAsStandardUser(): Promise<void> {
    await this.loginAs('standard_user', 'secret_sauce');
  }

  async loginAsLockedUser(): Promise<void> {
    await this.loginAs('locked_out_user', 'secret_sauce');
  }

  // ─── Assertions ───────────────────────────────────────────────────────────

  async assertOnLoginPage(): Promise<void> {
    await this.assertUrl('https://www.saucedemo.com/');
    await this.usernameInput.assertVisible();
    await this.loginButton.assertVisible();
  }

  async assertLoginSuccessful(): Promise<void> {
    await this.assertUrl(/inventory\.html/);
  }

  async assertLoginFailed(): Promise<void> {
    await this.errorMessage.assertVisible();
  }

  async assertErrorContains(text: string): Promise<void> {
    await this.errorMessage.assertMessage(text);
  }
}
