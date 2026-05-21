/**
 * CartPage — /cart.html on SauceDemo
 */

import { Page, expect } from '@playwright/test';
import { BasePage } from '../BasePage';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';
import { ButtonComponent } from '../../components';

export class CartPage extends BasePage {

  readonly checkoutButton = new ButtonComponent(
    this.page, this.obs,
    { css: '[data-test="checkout"]' },
    'Checkout Button',
  );

  readonly continueShoppingButton = new ButtonComponent(
    this.page, this.obs,
    { css: '[data-test="continue-shopping"]' },
    'Continue Shopping',
  );

  constructor(page: Page, obs: ObservabilityCollector) {
    super(page, obs);
  }

  async getCartItemNames(): Promise<string[]> {
    return this.page
      .locator('[data-test="inventory-item-name"]')
      .allTextContents();
  }

  async getCartItemCount(): Promise<number> {
    return this.page.locator('.cart_item').count();
  }

  async getItemPrice(itemName: string): Promise<string> {
    const item = this.page.locator('.cart_item').filter({ hasText: itemName });
    return (await item.locator('.inventory_item_price').textContent() ?? '').trim();
  }

  async removeItem(itemName: string): Promise<void> {
    const item = this.page.locator('.cart_item').filter({ hasText: itemName });
    await item.locator('button[data-test^="remove"]').click();
  }

  async proceedToCheckout(): Promise<void> {
    await this.checkoutButton.clickAndWait();
  }

  async continueShopping(): Promise<void> {
    await this.continueShoppingButton.clickAndWait();
  }

  // ─── Assertions ───────────────────────────────────────────────────────────

  async assertOnCartPage(): Promise<void> {
    await this.assertUrl(/cart\.html/);
  }

  async assertItemInCart(itemName: string): Promise<void> {
    const names = await this.getCartItemNames();
    expect(names).toContain(itemName);
  }

  async assertCartItemCount(expected: number): Promise<void> {
    const count = await this.getCartItemCount();
    expect(count).toBe(expected);
  }

  async assertCartEmpty(): Promise<void> {
    const count = await this.getCartItemCount();
    expect(count).toBe(0);
  }
}
