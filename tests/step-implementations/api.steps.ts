/**
 * API step implementations — uses Playwright's APIRequestContext (no browser).
 */

import { Step, DataStoreFactory } from 'gauge-ts';
import { request, APIResponse } from 'playwright';
import { EnvLoader } from '../utils/EnvLoader';
import { logger } from '../utils/Logger';
import * as assert from 'assert';

const env = EnvLoader.load();

export default class ApiSteps {

  private getLastResponse(): APIResponse {
    return DataStoreFactory.getScenarioDataStore().get('lastApiResponse') as APIResponse;
  }

  @Step('Send GET request to the health check endpoint')
  async getHealthCheck(): Promise<void> {
    const ctx      = await request.newContext({ baseURL: env.apiBaseURL });
    const response = await ctx.get(env.healthCheckApi);
    DataStoreFactory.getScenarioDataStore().put('lastApiResponse', response);
    logger.info(`GET ${env.healthCheckApi} → ${response.status()}`);
  }

  @Step('Send POST login request with valid credentials')
  async postLoginValid(): Promise<void> {
    const ctx      = await request.newContext({ baseURL: env.apiBaseURL });
    const response = await ctx.post(env.loginApi, {
      data:    { username: env.username, password: env.password },
      headers: { 'Content-Type': 'application/json' },
    });
    DataStoreFactory.getScenarioDataStore().put('lastApiResponse', response);
    const body = await response.json().catch(() => ({}));
    DataStoreFactory.getScenarioDataStore().put('authToken', body?.token ?? body?.access_token ?? '');
    logger.info(`POST ${env.loginApi} → ${response.status()}`);
  }

  @Step('Send POST login request with invalid credentials')
  async postLoginInvalid(): Promise<void> {
    const ctx      = await request.newContext({ baseURL: env.apiBaseURL });
    const response = await ctx.post(env.loginApi, {
      data:    { username: 'invalid_user', password: 'wrong_password' },
      headers: { 'Content-Type': 'application/json' },
    });
    DataStoreFactory.getScenarioDataStore().put('lastApiResponse', response);
    logger.info(`POST ${env.loginApi} (invalid) → ${response.status()}`);
  }

  @Step('Send GET request to the user list endpoint without auth token')
  async getUserListNoAuth(): Promise<void> {
    const ctx      = await request.newContext({ baseURL: env.apiBaseURL });
    const response = await ctx.get(env.userListApi);
    DataStoreFactory.getScenarioDataStore().put('lastApiResponse', response);
    logger.info(`GET ${env.userListApi} (no auth) → ${response.status()}`);
  }

  @Step('Verify the response status is <status>')
  async verifyStatus(status: string): Promise<void> {
    const response = this.getLastResponse();
    assert.strictEqual(response.status(), parseInt(status, 10),
      `Expected status ${status}, got ${response.status()}`);
  }

  @Step('Verify the response body contains a status field')
  async verifyHealthBody(): Promise<void> {
    const response = this.getLastResponse();
    const body     = await response.json();
    assert.ok(body?.status !== undefined, 'Response body missing "status" field');
  }

  @Step('Verify the response contains an access token')
  async verifyAccessToken(): Promise<void> {
    const response = this.getLastResponse();
    const body     = await response.json();
    const hasToken = body?.token !== undefined || body?.access_token !== undefined;
    assert.ok(hasToken, 'Response body missing token field');
  }
}
