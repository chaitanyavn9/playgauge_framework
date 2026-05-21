# Login Module

Specification covering authentication flows for the application.
All scenarios run with full observability (console + network profiling).

Tags: regression, login

## Successful login with valid credentials
Tags: smoke

* Open the login page
* Enter username "standard_user" and password "secret_sauce"
* Click the login button
* Verify the user is redirected to the dashboard
* Verify the welcome banner is visible

## Login fails with invalid credentials
Tags: regression

* Open the login page
* Enter username "invalid_user" and password "wrong_pass"
* Click the login button
* Verify an error message is displayed
* Verify the user remains on the login page

## Login page elements are visible
Tags: smoke

* Open the login page
* Verify username field is visible
* Verify password field is visible
* Verify login button is visible

## Successful logout after login
Tags: regression

* Open the login page
* Enter username "standard_user" and password "secret_sauce"
* Click the login button
* Verify the user is redirected to the dashboard
* Click the logout button
* Verify the user is redirected to the login page
