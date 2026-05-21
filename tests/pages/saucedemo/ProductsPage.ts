/**
 * ProductsPage — /inventory.html on SauceDemo
 * Demonstrates DataTableComponent-style row logic on a product grid.
 */

import { Page, expect } from '@playwright/test';
import { BasePage } from '../BasePage';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';
import { ButtonComponent, DropdownComponent } from '../../components';

export class ProductsPage extends BasePage {

  // ─── Components ───────────────────────────────────────────────────────────

  readonly sortDropdown = new DropdownComponent(
    this.page, this.obs,
    { css: '[data-test="product-sort-container"]' },
    'Sort Dropdown', 'native',
  );

  readonly cartLink = new ButtonComponent(
    this.page, this.obs,
    { css: '.shopping_cart_link' },
    'Cart Link',
  );

  constructor(page: Page, obs: ObservabilityCollector) {
    super(page, obs);
  }

  // ─── Product grid helpers ─────────────────────────────────────────────────

  async getProductNames(): Promise<string[]> {
    return this.page
      .locator('[data-test="inventory-item-name"]')
      .allTextContents();
  }

  async getProductCount(): Promise<number> {
    return this.page.locator('.inventory_item').count();
  }

  async getProductPrice(productName: string): Promise<string> {
    const item = this.page
      .locator('.inventory_item')
      .filter({ hasText: productName });
    return (await item.locator('.inventory_item_price').textContent() ?? '').trim();
  }

  async addToCart(productName: string): Promise<void> {
    const item = this.page
      .locator('.inventory_item')
      .filter({ hasText: productName });

    const addBtn = item.locator('button[data-test^="add-to-cart"]');
    await addBtn.click();
  }

  async removeFromCart(productName: string): Promise<void> {
    const item = this.page
      .locator('.inventory_item')
      .filter({ hasText: productName });
    const removeBtn = item.locator('button[data-test^="remove"]');
    await removeBtn.click();
  }

  async getCartBadgeCount(): Promise<number> {
    const badge = this.page.locator('.shopping_cart_badge');
    const isVisible = await badge.isVisible();
    if (!isVisible) return 0;
    const text = await badge.textContent();
    return parseInt(text ?? '0', 10);
  }

  async goToCart(): Promise<void> {
    await this.cartLink.click();
    await this.waitForPageReady();
  }

  async sortProductsBy(option: string): Promise<void> {
    await this.sortDropdown.selectByText(option);
  }

  // ─── Assertions ───────────────────────────────────────────────────────────

  async assertOnProductsPage(): Promise<void> {
    await this.assertUrl(/inventory\.html/);
    await expect(this.page.locator('.inventory_list')).toBeVisible();
  }

  async assertProductCount(expected: number): Promise<void> {
    const count = await this.getProductCount();
    expect(count).toBe(expected);
  }

  async assertCartBadge(expected: number): Promise<void> {
    const count = await this.getCartBadgeCount();
    expect(count).toBe(expected);
  }

  async assertProductVisible(name: string): Promise<void> {
    await expect(
      this.page.locator('[data-test="inventory-item-name"]', { hasText: name }).first(),
    ).toBeVisible();
  }
}
