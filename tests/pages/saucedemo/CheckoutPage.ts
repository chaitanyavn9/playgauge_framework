/**
 * CheckoutPage — covers both step-one and step-two + complete pages.
 * Kept in one file since the flow is linear.
 */

import { Page, expect } from '@playwright/test';
import { BasePage } from '../BasePage';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';
import { InputComponent, ButtonComponent } from '../../components';

export interface CheckoutDetails {
  firstName: string;
  lastName: string;
  zipCode: string;
}

export class CheckoutPage extends BasePage {

  // ─── Step 1 components ────────────────────────────────────────────────────

  readonly firstNameInput = new InputComponent(
    this.page, this.obs,
    { css: '[data-test="firstName"]' },
    'First Name',
  );

  readonly lastNameInput = new InputComponent(
    this.page, this.obs,
    { css: '[data-test="lastName"]' },
    'Last Name',
  );

  readonly zipCodeInput = new InputComponent(
    this.page, this.obs,
    { css: '[data-test="postalCode"]' },
    'Zip Code',
  );

  readonly continueButton = new ButtonComponent(
    this.page, this.obs,
    { css: '[data-test="continue"]' },
    'Continue',
  );

  // ─── Step 2 components ────────────────────────────────────────────────────

  readonly finishButton = new ButtonComponent(
    this.page, this.obs,
    { css: '[data-test="finish"]' },
    'Finish',
  );

  readonly cancelButton = new ButtonComponent(
    this.page, this.obs,
    { css: '[data-test="cancel"]' },
    'Cancel',
  );

  constructor(page: Page, obs: ObservabilityCollector) {
    super(page, obs);
  }

  // ─── Step 1 — Enter details ───────────────────────────────────────────────

  async fillShippingDetails(details: CheckoutDetails): Promise<void> {
    await this.firstNameInput.fill(details.firstName);
    await this.lastNameInput.fill(details.lastName);
    await this.zipCodeInput.fill(details.zipCode);
    await this.continueButton.clickAndWait();
  }

  // ─── Step 2 — Review order ────────────────────────────────────────────────

  async getOrderTotal(): Promise<string> {
    return (await this.page.locator('.summary_total_label').textContent() ?? '').trim();
  }

  async getItemTotal(): Promise<string> {
    return (await this.page.locator('.summary_subtotal_label').textContent() ?? '').trim();
  }

  async getTax(): Promise<string> {
    return (await this.page.locator('.summary_tax_label').textContent() ?? '').trim();
  }

  async confirmOrder(): Promise<void> {
    await this.finishButton.clickAndWait();
  }

  async cancelCheckout(): Promise<void> {
    await this.cancelButton.clickAndWait();
  }

  // ─── Complete page ────────────────────────────────────────────────────────

  async getSuccessMessage(): Promise<string> {
    return (await this.page.locator('[data-test="complete-header"]').textContent() ?? '').trim();
  }

  async getSuccessSubtext(): Promise<string> {
    return (await this.page.locator('[data-test="complete-text"]').textContent() ?? '').trim();
  }

  // ─── Assertions ───────────────────────────────────────────────────────────

  async assertOnStepOne(): Promise<void> {
    await this.assertUrl(/checkout-step-one\.html/);
    await this.firstNameInput.assertVisible();
  }

  async assertOnStepTwo(): Promise<void> {
    await this.assertUrl(/checkout-step-two\.html/);
    await expect(this.page.locator('.checkout_summary_container')).toBeVisible();
  }

  async assertOrderComplete(): Promise<void> {
    await this.assertUrl(/checkout-complete\.html/);
    await expect(this.page.locator('[data-test="complete-header"]')).toContainText('Thank you');
  }

  async assertValidationError(message: string): Promise<void> {
    await expect(this.page.locator('[data-test="error"]')).toContainText(message);
  }
}
