/**
 * SauceDemo step implementations.
 * Notice: steps are clean English — no selectors, no Playwright APIs.
 * All UI knowledge lives in the page + component layer.
 */

import { Step, DataStore } from 'gauge-ts';
import { Page } from 'playwright';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';
import { SauceLoginPage } from '../../pages/saucedemo/SauceLoginPage';
import { ProductsPage }   from '../../pages/saucedemo/ProductsPage';
import { CartPage }       from '../../pages/saucedemo/CartPage';
import { CheckoutPage }   from '../../pages/saucedemo/CheckoutPage';
import { expect }         from '@playwright/test';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPage(): Page                    { return DataStore.ScenarioDataStore.get('page') as Page; }
function getObs():  ObservabilityCollector  { return DataStore.ScenarioDataStore.get('obs')  as ObservabilityCollector; }

function login():    SauceLoginPage  { return new SauceLoginPage(getPage(), getObs()); }
function products(): ProductsPage    { return new ProductsPage(getPage(), getObs()); }
function cart():     CartPage        { return new CartPage(getPage(), getObs()); }
function checkout(): CheckoutPage    { return new CheckoutPage(getPage(), getObs()); }

// ─── Login steps ─────────────────────────────────────────────────────────────

@Step('Open SauceDemo login page')
async function openSauceLogin(): Promise<void> {
  await login().open();
}

@Step('Login as <username> with password <password>')
async function loginAs(username: string, password: string): Promise<void> {
  await login().loginAs(username, password);
}

@Step('Verify landing on the products page')
async function verifyProductsPage(): Promise<void> {
  await products().assertOnProductsPage();
}

@Step('Verify login error is displayed')
async function verifyLoginError(): Promise<void> {
  await login().assertLoginFailed();
}

@Step('Verify error contains <text>')
async function verifyErrorText(text: string): Promise<void> {
  await login().assertErrorContains(text);
}

@Step('Verify username field is present on login page')
async function verifyUsernameField(): Promise<void> {
  await login().usernameInput.assertVisible();
}

@Step('Verify password field is present on login page')
async function verifyPasswordField(): Promise<void> {
  await login().passwordInput.assertVisible();
}

@Step('Verify login button is present on login page')
async function verifyLoginBtn(): Promise<void> {
  await login().loginButton.assertVisible();
}

// ─── Products steps ───────────────────────────────────────────────────────────

@Step('Verify exactly <count> products are displayed')
async function verifyProductCount(count: string): Promise<void> {
  await products().assertProductCount(parseInt(count, 10));
}

@Step('Add product <name> to cart')
async function addProductToCart(name: string): Promise<void> {
  await products().addToCart(name);
}

@Step('Verify cart badge shows <count> item')
async function verifyCartBadge(count: string): Promise<void> {
  await products().assertCartBadge(parseInt(count, 10));
}

@Step('Verify cart badge shows <count> items')
async function verifyCartBadgePlural(count: string): Promise<void> {
  await products().assertCartBadge(parseInt(count, 10));
}

@Step('Sort products by <option>')
async function sortProducts(option: string): Promise<void> {
  await products().sortProductsBy(option);
}

// ─── Cart steps ───────────────────────────────────────────────────────────────

@Step('Go to cart page')
async function goToCart(): Promise<void> {
  await products().goToCart();
  await cart().assertOnCartPage();
}

@Step('Verify <item> is in the cart')
async function verifyItemInCart(item: string): Promise<void> {
  await cart().assertItemInCart(item);
}

@Step('Proceed to checkout')
async function proceedToCheckout(): Promise<void> {
  await cart().proceedToCheckout();
  await checkout().assertOnStepOne();
}

@Step('Remove <item> from cart')
async function removeItemFromCart(item: string): Promise<void> {
  await cart().removeItem(item);
}

@Step('Verify cart is empty')
async function verifyCartEmpty(): Promise<void> {
  await cart().assertCartEmpty();
}

// ─── Checkout steps ───────────────────────────────────────────────────────────

@Step('Fill shipping details with first name <first> last name <last> zip <zip>')
async function fillShippingDetails(first: string, last: string, zip: string): Promise<void> {
  await checkout().fillShippingDetails({ firstName: first, lastName: last, zipCode: zip });
}

@Step('Try to continue without filling shipping details')
async function continueWithoutDetails(): Promise<void> {
  await checkout().continueButton.click();
}

@Step('Verify checkout validation error <message>')
async function verifyCheckoutError(message: string): Promise<void> {
  await checkout().assertValidationError(message);
}

@Step('Verify on checkout overview page')
async function verifyCheckoutOverview(): Promise<void> {
  await checkout().assertOnStepTwo();
}

@Step('Confirm and finish the order')
async function confirmOrder(): Promise<void> {
  await checkout().confirmOrder();
}

@Step('Verify order completed successfully')
async function verifyOrderComplete(): Promise<void> {
  await checkout().assertOrderComplete();
}
