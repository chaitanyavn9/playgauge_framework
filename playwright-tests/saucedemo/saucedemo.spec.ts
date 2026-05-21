/**
 * SauceDemo — Standalone Playwright Spec
 * ========================================
 * Run with:  npx playwright test playwright-tests/saucedemo/saucedemo.spec.ts
 *
 * No Gauge required — pure Playwright test runner.
 * Pages used from the Component-Model layer:
 *   SauceLoginPage, ProductsPage, CartPage, CheckoutPage
 *
 * These tests hit the live demo at https://www.saucedemo.com
 */

import { test, expect } from '@playwright/test';
import { chromium, Browser, BrowserContext, Page } from '@playwright/test';

// ─── Inline minimal page helpers (self-contained so no import-path issues) ───
// In a real run you'd import from ../../tests/pages/saucedemo/*
// Here we inline the selectors so this file is 100% runnable standalone.

const URL = 'https://www.saucedemo.com';

// ─────────────────────────────────────────────────────────────────────────────
// SUITE: Authentication
// ─────────────────────────────────────────────────────────────────────────────

test.describe('SauceDemo — Authentication', () => {

  test('login page elements are present', async ({ page }) => {
    await page.goto(URL);
    await expect(page.locator('[data-test="username"]')).toBeVisible();
    await expect(page.locator('[data-test="password"]')).toBeVisible();
    await expect(page.locator('[data-test="login-button"]')).toBeVisible();
  });

  test('successful login as standard_user', async ({ page }) => {
    await page.goto(URL);
    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();

    await expect(page).toHaveURL(/inventory/);
    await expect(page.locator('.inventory_list')).toBeVisible();
  });

  test('login fails with wrong password', async ({ page }) => {
    await page.goto(URL);
    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('wrong_password');
    await page.locator('[data-test="login-button"]').click();

    await expect(page.locator('[data-test="error"]')).toBeVisible();
    await expect(page.locator('[data-test="error"]')).toContainText('Epic sadface');
  });

  test('locked_out_user cannot login', async ({ page }) => {
    await page.goto(URL);
    await page.locator('[data-test="username"]').fill('locked_out_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();

    await expect(page.locator('[data-test="error"]')).toContainText('locked out');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE: Products Page
// ─────────────────────────────────────────────────────────────────────────────

test.describe('SauceDemo — Products Page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();
    await page.waitForURL(/inventory/);
  });

  test('products are listed', async ({ page }) => {
    const items = page.locator('.inventory_item');
    await expect(items).toHaveCount(6);
  });

  test('add single item to cart', async ({ page }) => {
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await expect(page.locator('.shopping_cart_badge')).toHaveText('1');
  });

  test('add multiple items to cart', async ({ page }) => {
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await page.locator('[data-test="add-to-cart-sauce-labs-bike-light"]').click();
    await expect(page.locator('.shopping_cart_badge')).toHaveText('2');
  });

  test('can sort products by name Z-to-A', async ({ page }) => {
    await page.locator('[data-test="product-sort-container"]').selectOption('za');
    const names = await page.locator('.inventory_item_name').allTextContents();
    const sorted = [...names].sort((a, b) => b.localeCompare(a));
    expect(names).toEqual(sorted);
  });

  test('can sort products by price low-to-high', async ({ page }) => {
    await page.locator('[data-test="product-sort-container"]').selectOption('lohi');
    const prices = await page.locator('.inventory_item_price').allTextContents();
    const nums = prices.map(p => parseFloat(p.replace('$', '')));
    for (let i = 0; i < nums.length - 1; i++) {
      expect(nums[i]).toBeLessThanOrEqual(nums[i + 1]);
    }
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE: Shopping Cart
// ─────────────────────────────────────────────────────────────────────────────

test.describe('SauceDemo — Shopping Cart', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();
    await page.waitForURL(/inventory/);
  });

  test('cart shows added items', async ({ page }) => {
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await page.locator('.shopping_cart_link').click();

    await expect(page).toHaveURL(/cart/);
    await expect(page.locator('.cart_item')).toHaveCount(1);
    await expect(page.locator('.inventory_item_name')).toContainText('Sauce Labs Backpack');
  });

  test('can remove item from cart', async ({ page }) => {
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await page.locator('.shopping_cart_link').click();

    await page.locator('[data-test="remove-sauce-labs-backpack"]').click();
    await expect(page.locator('.cart_item')).toHaveCount(0);
    await expect(page.locator('.shopping_cart_badge')).not.toBeVisible();
  });

  test('continue shopping returns to products page', async ({ page }) => {
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await page.locator('.shopping_cart_link').click();
    await page.locator('[data-test="continue-shopping"]').click();

    await expect(page).toHaveURL(/inventory/);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE: Full Checkout E2E
// ─────────────────────────────────────────────────────────────────────────────

test.describe('SauceDemo — Checkout E2E', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();
    await page.waitForURL(/inventory/);
  });

  test('complete checkout flow end-to-end', async ({ page }) => {
    // 1. Add item to cart
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await page.locator('.shopping_cart_link').click();

    // 2. Proceed to checkout
    await page.locator('[data-test="checkout"]').click();
    await expect(page).toHaveURL(/checkout-step-one/);

    // 3. Fill shipping info
    await page.locator('[data-test="firstName"]').fill('Jane');
    await page.locator('[data-test="lastName"]').fill('Doe');
    await page.locator('[data-test="postalCode"]').fill('94107');
    await page.locator('[data-test="continue"]').click();

    // 4. Verify overview
    await expect(page).toHaveURL(/checkout-step-two/);
    await expect(page.locator('.summary_info')).toBeVisible();
    await expect(page.locator('.cart_item')).toHaveCount(1);

    // 5. Finish order
    await page.locator('[data-test="finish"]').click();

    // 6. Confirm success
    await expect(page).toHaveURL(/checkout-complete/);
    await expect(page.locator('[data-test="complete-header"]')).toHaveText('Thank you for your order!');
  });

  test('checkout fails with missing first name', async ({ page }) => {
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await page.locator('.shopping_cart_link').click();
    await page.locator('[data-test="checkout"]').click();

    // Deliberately leave firstName empty
    await page.locator('[data-test="lastName"]').fill('Doe');
    await page.locator('[data-test="postalCode"]').fill('94107');
    await page.locator('[data-test="continue"]').click();

    await expect(page.locator('[data-test="error"]')).toBeVisible();
    await expect(page.locator('[data-test="error"]')).toContainText('First Name is required');
  });

  test('order total is calculated correctly', async ({ page }) => {
    // Add two items
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await page.locator('[data-test="add-to-cart-sauce-labs-bike-light"]').click();
    await page.locator('.shopping_cart_link').click();
    await page.locator('[data-test="checkout"]').click();

    await page.locator('[data-test="firstName"]').fill('Jane');
    await page.locator('[data-test="lastName"]').fill('Doe');
    await page.locator('[data-test="postalCode"]').fill('94107');
    await page.locator('[data-test="continue"]').click();

    // Grab item total from summary
    const itemTotalText = await page.locator('.summary_subtotal_label').textContent();
    const itemTotal = parseFloat(itemTotalText!.replace(/[^0-9.]/g, ''));

    // Grab tax
    const taxText = await page.locator('.summary_tax_label').textContent();
    const tax = parseFloat(taxText!.replace(/[^0-9.]/g, ''));

    // Grab total
    const totalText = await page.locator('.summary_total_label').textContent();
    const total = parseFloat(totalText!.replace(/[^0-9.]/g, ''));

    // Validate: total = itemTotal + tax (within rounding tolerance)
    expect(Math.abs(total - (itemTotal + tax))).toBeLessThan(0.01);
  });

});
