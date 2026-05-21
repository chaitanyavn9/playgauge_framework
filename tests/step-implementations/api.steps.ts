/**
 * API step implementations — uses Playwright's APIRequestContext (no browser).
 * Switch to Newman/Postman collection runner when API suite grows large.
 */

import { Step, DataStore } from 'gauge-ts';
import { request, APIResponse } from 'playwright';
import { EnvLoader } from '../utils/EnvLoader';
import { logger } from '../utils/Logger';
import * as assert from 'assert';

const env = EnvLoader.load();

function getLastResponse(): APIResponse {
  return DataStore.ScenarioDataStore.get('lastApiResponse') as APIResponse;
}

@Step('Send GET request to the health check endpoint')
async function getHealthCheck(): Promise<void> {
  const ctx      = await request.newContext({ baseURL: env.apiBaseURL });
  const response = await ctx.get(env.healthCheckApi);
  DataStore.ScenarioDataStore.put('lastApiResponse', response);
  logger.info(`GET ${env.healthCheckApi} → ${response.status()}`);
}

@Step('Send POST login request with valid credentials')
async function postLoginValid(): Promise<void> {
  const ctx = await request.newContext({ baseURL: env.apiBaseURL });
  const response = await ctx.post(env.loginApi, {
    data: { username: env.username, password: env.password },
    headers: { 'Content-Type': 'application/json' },
  });
  DataStore.ScenarioDataStore.put('lastApiResponse', response);
  const body = await response.json().catch(() => ({}));
  DataStore.ScenarioDataStore.put('authToken', body?.token ?? body?.access_token ?? '');
  logger.info(`POST ${env.loginApi} → ${response.status()}`);
}

@Step('Send POST login request with invalid credentials')
async function postLoginInvalid(): Promise<void> {
  const ctx = await request.newContext({ baseURL: env.apiBaseURL });
  const response = await ctx.post(env.loginApi, {
    data: { username: 'invalid_user', password: 'wrong_password' },
    headers: { 'Content-Type': 'application/json' },
  });
  DataStore.ScenarioDataStore.put('lastApiResponse', response);
  logger.info(`POST ${env.loginApi} (invalid) → ${response.status()}`);
}

@Step('Send GET request to the user list endpoint without auth token')
async function getUserListNoAuth(): Promise<void> {
  const ctx = await request.newContext({ baseURL: env.apiBaseURL });
  const response = await ctx.get(env.userListApi);
  DataStore.ScenarioDataStore.put('lastApiResponse', response);
  logger.info(`GET ${env.userListApi} (no auth) → ${response.status()}`);
}

@Step('Verify the response status is <status>')
async function verifyStatus(status: string): Promise<void> {
  const response = getLastResponse();
  assert.strictEqual(response.status(), parseInt(status, 10),
    `Expected status ${status}, got ${response.status()}`);
}

@Step('Verify the response body contains a status field')
async function verifyHealthBody(): Promise<void> {
  const response = getLastResponse();
  const body = await response.json();
  assert.ok(body?.status !== undefined, 'Response body missing "status" field');
}

@Step('Verify the response contains an access token')
async function verifyAccessToken(): Promise<void> {
  const response = getLastResponse();
  const body = await response.json();
  const hasToken = body?.token !== undefined || body?.access_token !== undefined;
  assert.ok(hasToken, 'Response body missing token field');
}
