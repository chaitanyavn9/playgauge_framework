# SauceDemo Login

Login and authentication scenarios for SauceDemo.

Tags: saucedemo, regression, login

## Successful login with standard user
Tags: smoke

* Open SauceDemo login page
* Login as "standard_user" with password "secret_sauce"
* Verify landing on the products page

## Login fails with wrong password
Tags: regression

* Open SauceDemo login page
* Login as "standard_user" with password "wrong_password"
* Verify login error is displayed
* Verify error contains "Username and password do not match"

## Locked out user cannot login
Tags: regression

* Open SauceDemo login page
* Login as "locked_out_user" with password "secret_sauce"
* Verify login error is displayed
* Verify error contains "Sorry, this user has been locked out"

## Login page has all required elements
Tags: smoke

* Open SauceDemo login page
* Verify username field is present on login page
* Verify password field is present on login page
* Verify login button is present on login page
