# OrangeHRM Login

Authentication scenarios for OrangeHRM demo application.

Tags: orangehrm, regression, login

## Successful admin login
Tags: smoke

* Open OrangeHRM login page
* Login to OrangeHRM as "Admin" with password "admin123"
* Verify OrangeHRM dashboard is loaded

## Login fails with invalid credentials
Tags: regression

* Open OrangeHRM login page
* Login to OrangeHRM as "invalid_user" with password "wrong_pass"
* Verify OrangeHRM login error is shown

## Login page elements are present
Tags: smoke

* Open OrangeHRM login page
* Verify OrangeHRM username field is visible
* Verify OrangeHRM password field is visible
* Verify OrangeHRM login button is visible

## Admin can log out
Tags: regression

* Open OrangeHRM login page
* Login to OrangeHRM as "Admin" with password "admin123"
* Verify OrangeHRM dashboard is loaded
* Logout from OrangeHRM
* Verify redirected to OrangeHRM login page
