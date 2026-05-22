/**
 * SauceDemo step implementations.
 * Notice: steps are clean English — no selectors, no Playwright APIs.
 * All UI knowledge lives in the page + component layer.
 */

import { Step, DataStoreFactory } from 'gauge-ts';
import { Page } from 'playwright';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';
import { SauceLoginPage } from '../../pages/saucedemo/SauceLoginPage';
import { ProductsPage }   from '../../pages/saucedemo/ProductsPage';
import { CartPage }       from '../../pages/saucedemo/CartPage';
import { CheckoutPage }   from '../../pages/saucedemo/CheckoutPage';
import { expect }         from '@playwright/test';

export class SauceDemoSteps {

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private getPage(): Page                   { return DataStoreFactory.getScenarioDataStore().get('page') as Page; }
  private getObs():  ObservabilityCollector { return DataStoreFactory.getScenarioDataStore().get('obs')  as ObservabilityCollector; }

  private login():    SauceLoginPage  { return new SauceLoginPage(this.getPage(), this.getObs()); }
  private products(): ProductsPage    { return new ProductsPage(this.getPage(), this.getObs()); }
  private cart():     CartPage        { return new CartPage(this.getPage(), this.getObs()); }
  private checkout(): CheckoutPage    { return new CheckoutPage(this.getPage(), this.getObs()); }

  // ─── Login steps ─────────────────────────────────────────────────────────────

  @Step('Open SauceDemo login page')
  async openSauceLogin(): Promise<void> {
    await this.login().open();
  }

  @Step('Login as <username> with password <password>')
  async loginAs(username: string, password: string): Promise<void> {
    await this.login().loginAs(username, password);
  }

  @Step('Verify landing on the products page')
  async verifyProductsPage(): Promise<void> {
    await this.products().assertOnProductsPage();
  }

  @Step('Verify login error is displayed')
  async verifyLoginError(): Promise<void> {
    await this.login().assertLoginFailed();
  }

  @Step('Verify error contains <text>')
  async verifyErrorText(text: string): Promise<void> {
    await this.login().assertErrorContains(text);
  }

  @Step('Verify username field is present on login page')
  async verifyUsernameField(): Promise<void> {
    await this.login().usernameInput.assertVisible();
  }

  @Step('Verify password field is present on login page')
  async verifyPasswordField(): Promise<void> {
    await this.login().passwordInput.assertVisible();
  }

  @Step('Verify login button is present on login page')
  async verifyLoginBtn(): Promise<void> {
    await this.login().loginButton.assertVisible();
  }

  // ─── Products steps ───────────────────────────────────────────────────────────

  @Step('Verify exactly <count> products are displayed')
  async verifyProductCount(count: string): Promise<void> {
    await this.products().assertProductCount(parseInt(count, 10));
  }

  @Step('Add product <name> to cart')
  async addProductToCart(name: string): Promise<void> {
    await this.products().addToCart(name);
  }

  @Step('Verify cart badge shows <count> item')
  async verifyCartBadge(count: string): Promise<void> {
    await this.products().assertCartBadge(parseInt(count, 10));
  }

  @Step('Verify cart badge shows <count> items')
  async verifyCartBadgePlural(count: string): Promise<void> {
    await this.products().assertCartBadge(parseInt(count, 10));
  }

  @Step('Sort products by <option>')
  async sortProducts(option: string): Promise<void> {
    await this.products().sortProductsBy(option);
  }

  // ─── Cart steps ───────────────────────────────────────────────────────────────

  @Step('Go to cart page')
  async goToCart(): Promise<void> {
    await this.products().goToCart();
    await this.cart().assertOnCartPage();
  }

  @Step('Verify <item> is in the cart')
  async verifyItemInCart(item: string): Promise<void> {
    await this.cart().assertItemInCart(item);
  }

  @Step('Proceed to checkout')
  async proceedToCheckout(): Promise<void> {
    await this.cart().proceedToCheckout();
    await this.checkout().assertOnStepOne();
  }

  @Step('Remove <item> from cart')
  async removeItemFromCart(item: string): Promise<void> {
    await this.cart().removeItem(item);
  }

  @Step('Verify cart is empty')
  async verifyCartEmpty(): Promise<void> {
    await this.cart().assertCartEmpty();
  }

  // ─── Checkout steps ───────────────────────────────────────────────────────────

  @Step('Fill shipping details with first name <first> last name <last> zip <zip>')
  async fillShippingDetails(first: string, last: string, zip: string): Promise<void> {
    await this.checkout().fillShippingDetails({ firstName: first, lastName: last, zipCode: zip });
  }

  @Step('Try to continue without filling shipping details')
  async continueWithoutDetails(): Promise<void> {
    await this.checkout().continueButton.click();
  }

  @Step('Verify checkout validation error <message>')
  async verifyCheckoutError(message: string): Promise<void> {
    await this.checkout().assertValidationError(message);
  }

  @Step('Verify on checkout overview page')
  async verifyCheckoutOverview(): Promise<void> {
    await this.checkout().assertOnStepTwo();
  }

  @Step('Confirm and finish the order')
  async confirmOrder(): Promise<void> {
    await this.checkout().confirmOrder();
  }

  @Step('Verify order completed successfully')
  async verifyOrderComplete(): Promise<void> {
    await this.checkout().assertOrderComplete();
  }
}
