# OrangeHRM Dashboard and Navigation

Post-login navigation and dashboard functionality.

Tags: orangehrm, regression, dashboard

## Dashboard shows correct modules in navigation
Tags: smoke

* Open OrangeHRM login page
* Login to OrangeHRM as "Admin" with password "admin123"
* Verify OrangeHRM dashboard is loaded
* Verify module "Admin" is visible in nav
* Verify module "PIM" is visible in nav
* Verify module "Leave" is visible in nav
* Verify module "Time" is visible in nav

## Admin can navigate to User Management
Tags: regression

* Open OrangeHRM login page
* Login to OrangeHRM as "Admin" with password "admin123"
* Navigate to OrangeHRM module "Admin"
* Verify on OrangeHRM Admin user management page
* Verify users table has records

## Admin user is displayed in header
Tags: smoke

* Open OrangeHRM login page
* Login to OrangeHRM as "Admin" with password "admin123"
* Verify OrangeHRM dashboard is loaded
* Verify user dropdown is visible

## Search for admin user in user management
Tags: regression

* Open OrangeHRM login page
* Login to OrangeHRM as "Admin" with password "admin123"
* Navigate to OrangeHRM module "Admin"
* Search for user "Admin" in admin page
* Verify user "Admin" exists in search results
