/**
 * FormComponent — a composite component that owns a group of form fields.
 * Useful for reusable form sections like LoginForm, SearchForm, FilterForm.
 *
 * Usage:
 *   class LoginForm extends FormComponent {
 *     username = new InputComponent(this.page, this.obs, { automationId: 'login-username' });
 *     password = new InputComponent(this.page, this.obs, { automationId: 'login-password' });
 *     submit   = new ButtonComponent(this.page, this.obs, { automationId: 'login-submit' });
 *
 *     async fill(data: { username: string; password: string }) {
 *       await this.username.fill(data.username);
 *       await this.password.fill(data.password);
 *     }
 *   }
 */

import { Page } from '@playwright/test';
import { BaseComponent, LocatorStrategy } from '../base/BaseComponent';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';
import { logger } from '../../utils/Logger';

export abstract class FormComponent extends BaseComponent {
  constructor(
    page: Page,
    obs: ObservabilityCollector,
    strategy: LocatorStrategy,
    name?: string,
  ) {
    super(page, obs, strategy, name ?? 'FormComponent');
  }

  /** Submit the form via its submit button or Enter key */
  async submitViaEnter(): Promise<void> {
    await this.interact('submitViaEnter', async () => {
      await this.root.press('Enter');
    });
  }

  /** Wait for the form to stop loading (spinner disappears) */
  async waitForIdle(spinnerSelector = '[data-loading="true"]', timeout = 15_000): Promise<void> {
    try {
      await this.page
        .locator(spinnerSelector)
        .waitFor({ state: 'hidden', timeout });
    } catch {
      logger.debug(`[${this.componentName}] No loading spinner found — continuing`);
    }
  }

  /** Assert a validation error appears on the form */
  async assertValidationError(expectedMessage?: string): Promise<void> {
    const errorLocator = this.root.locator(
      '[role="alert"], [data-error], .error-message, [automation-id$="-error"]',
    ).first();
    const { expect } = await import('@playwright/test');
    await expect(errorLocator).toBeVisible();
    if (expectedMessage) {
      await expect(errorLocator).toContainText(expectedMessage);
    }
  }

  /** Assert no validation errors are shown */
  async assertNoValidationErrors(): Promise<void> {
    const errorLocator = this.root.locator('[role="alert"], [data-error]');
    const { expect }   = await import('@playwright/test');
    await expect(errorLocator).toHaveCount(0);
  }
}
