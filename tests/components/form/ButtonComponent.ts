/**
 * ButtonComponent — models any clickable button, link-button, or icon action.
 *
 * Usage:
 *   const loginBtn = new ButtonComponent(page, obs, { automationId: 'login-submit' }, 'Login Button');
 *   await loginBtn.click();
 *   await loginBtn.assertLabel('Sign In');
 */

import { Page } from '@playwright/test';
import { BaseComponent, LocatorStrategy } from '../base/BaseComponent';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';

export class ButtonComponent extends BaseComponent {
  constructor(
    page: Page,
    obs: ObservabilityCollector,
    strategy: LocatorStrategy,
    name?: string,
  ) {
    super(page, obs, strategy, name ?? 'ButtonComponent');
  }

  async click(): Promise<void> {
    await this.interact('click', async () => {
      await this.root.click();
    });
  }

  /** Click and wait for network to settle — good for form submits */
  async clickAndWait(): Promise<void> {
    await this.interact('clickAndWait', async () => {
      await Promise.all([
        this.page.waitForLoadState('networkidle').catch(() => {}),
        this.root.click(),
      ]);
    });
  }

  async doubleClick(): Promise<void> {
    await this.interact('doubleClick', async () => {
      await this.root.dblclick();
    });
  }

  async rightClick(): Promise<void> {
    await this.interact('rightClick', async () => {
      await this.root.click({ button: 'right' });
    });
  }

  async hover(): Promise<void> {
    await this.interact('hover', async () => {
      await this.root.hover();
    });
  }

  async getLabel(): Promise<string> {
    return this.getText();
  }

  async assertLabel(expected: string | RegExp): Promise<void> {
    await this.assertText(expected);
  }

  async assertLoading(): Promise<void> {
    // Checks for common loading indicators (aria-busy, disabled during load)
    const { expect } = await import('@playwright/test');
    const isBusy     = await this.root.getAttribute('aria-busy');
    const isDisabled = await this.isDisabled();
    expect(isBusy === 'true' || isDisabled).toBeTruthy();
  }
}
