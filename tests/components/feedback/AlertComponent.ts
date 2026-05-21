/**
 * AlertComponent — models inline error banners, info alerts, success messages.
 *
 * Usage:
 *   const errorBanner = new AlertComponent(page, obs, { automationId: 'login-error' });
 *   await errorBanner.assertVisible();
 *   await errorBanner.assertType('error');
 *   await errorBanner.assertMessage('Invalid credentials');
 */

import { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BaseComponent, LocatorStrategy } from '../base/BaseComponent';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';

export type AlertType = 'error' | 'success' | 'warning' | 'info';

export class AlertComponent extends BaseComponent {
  constructor(
    page: Page,
    obs: ObservabilityCollector,
    strategy: LocatorStrategy,
    name?: string,
  ) {
    super(page, obs, strategy, name ?? 'AlertComponent');
  }

  async getMessage(): Promise<string> {
    return (await this.root.textContent() ?? '').trim();
  }

  async getType(): Promise<AlertType | string> {
    // Check common class/attribute patterns for alert type
    const role      = await this.root.getAttribute('role');
    const dataType  = await this.root.getAttribute('data-type');
    const className = await this.root.getAttribute('class') ?? '';

    if (dataType) return dataType;
    if (role === 'alert') return 'error';
    if (className.includes('success')) return 'success';
    if (className.includes('warning')) return 'warning';
    if (className.includes('info'))    return 'info';
    if (className.includes('error'))   return 'error';
    return 'unknown';
  }

  async dismiss(): Promise<void> {
    await this.interact('dismiss', async () => {
      const closeBtn = this.root
        .locator('[automation-id="alert-close"], [aria-label="Close"], button.close, button.dismiss')
        .first();
      await closeBtn.click();
    });
  }

  async waitForAlert(timeout = 10_000): Promise<void> {
    await this.root.waitFor({ state: 'visible', timeout });
  }

  async assertMessage(expected: string | RegExp): Promise<void> {
    if (expected instanceof RegExp) {
      const msg = await this.getMessage();
      expect(msg).toMatch(expected);
    } else {
      await this.assertContainsText(expected);
    }
  }

  async assertType(expected: AlertType): Promise<void> {
    const type = await this.getType();
    expect(type).toBe(expected);
  }

  async assertNotVisible(): Promise<void> {
    await this.assertHidden();
  }
}
