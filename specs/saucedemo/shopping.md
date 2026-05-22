# SauceDemo Shopping Flow

End-to-end shopping cart and checkout scenarios.

Tags: saucedemo, regression, shopping

## Products page loads with all items
Tags: smoke

* Open SauceDemo login page
* Login as "standard_user" with password "secret_sauce"
* Verify landing on the products page
* Verify exactly "6" products are displayed

## Add single item to cart
Tags: smoke, cart

* Open SauceDemo login page
* Login as "standard_user" with password "secret_sauce"
* Add product "Sauce Labs Backpack" to cart
* Verify cart badge shows "1" item

## Add multiple items to cart
Tags: regression, cart

* Open SauceDemo login page
* Login as "standard_user" with password "secret_sauce"
* Add product "Sauce Labs Backpack" to cart
* Add product "Sauce Labs Bike Light" to cart
* Verify cart badge shows "2" items

## Full checkout flow end-to-end
Tags: smoke, e2e

* Open SauceDemo login page
* Login as "standard_user" with password "secret_sauce"
* Add product "Sauce Labs Backpack" to cart
* Go to cart page
* Verify "Sauce Labs Backpack" is in the cart
* Proceed to checkout
* Fill shipping details with first name "John" last name "Doe" zip "12345"
* Verify on checkout overview page
* Confirm and finish the order
* Verify order completed successfully

## Checkout fails without filling details
Tags: regression

* Open SauceDemo login page
* Login as "standard_user" with password "secret_sauce"
* Add product "Sauce Labs Backpack" to cart
* Go to cart page
* Proceed to checkout
* Try to continue without filling shipping details
* Verify checkout validation error "First Name is required"

## Sort products by price low to high
Tags: regression

* Open SauceDemo login page
* Login as "standard_user" with password "secret_sauce"
* Sort products by "Price (low to high)"
* Verify landing on the products page

## Remove item from cart
Tags: regression, cart

* Open SauceDemo login page
* Login as "standard_user" with password "secret_sauce"
* Add product "Sauce Labs Backpack" to cart
* Go to cart page
* Remove "Sauce Labs Backpack" from cart
* Verify cart is empty
