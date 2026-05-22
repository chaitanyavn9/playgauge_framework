# API Health & Contracts

API-level tests using Playwright's request context.
No browser is launched — these are pure HTTP tests.

Tags: regression, api

## Health check endpoint returns 200
Tags: smoke, api

* Send GET request to the health check endpoint
* Verify the response status is "200"
* Verify the response body contains a status field

## Login API returns token with valid credentials
Tags: api, regression

* Send POST login request with valid credentials
* Verify the response status is "200"
* Verify the response contains an access token

## Login API returns 401 with invalid credentials
Tags: api, regression

* Send POST login request with invalid credentials
* Verify the response status is "401"

## User list API requires authentication
Tags: api, regression

* Send GET request to the user list endpoint without auth token
* Verify the response status is "401"
