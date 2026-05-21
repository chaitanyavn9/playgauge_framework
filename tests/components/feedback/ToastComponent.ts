/**
 * ToastComponent — models transient notification toasts.
 * Toasts appear briefly then auto-dismiss, so we use waitFor with timeout.
 *
 * Usage:
 *   const toast = new ToastComponent(page, obs, { css: '[data-toast]' });
 *   await toast.waitForToast();
 *   await toast.assertMessage('Saved successfully');
 *   await toast.assertType('success');
 */

import { Page } from '@playwright/test';
import { BaseComponent, LocatorStrategy } from '../base/BaseComponent';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';
import { AlertType } from './AlertComponent';

export class ToastComponent extends BaseComponent {
  constructor(
    page: Page,
    obs: ObservabilityCollector,
    strategy: LocatorStrategy,
    name?: string,
  ) {
    super(page, obs, strategy, name ?? 'ToastComponent');
  }

  /** Wait for the toast to appear */
  async waitForToast(timeout = 8_000): Promise<void> {
    await this.root.waitFor({ state: 'visible', timeout });
  }

  /** Wait for the toast to auto-dismiss */
  async waitForDismiss(timeout = 10_000): Promise<void> {
    await this.root.waitFor({ state: 'hidden', timeout });
  }

  /** Manually close the toast if it has a close button */
  async close(): Promise<void> {
    await this.interact('close', async () => {
      await this.root
        .locator('[automation-id="toast-close"], [aria-label="Close notification"], button.close')
        .first()
        .click();
    });
  }

  async getMessage(): Promise<string> {
    return (await this.root.textContent() ?? '').trim();
  }

  async getType(): Promise<AlertType | string> {
    const dataType  = await this.root.getAttribute('data-type');
    const className = await this.root.getAttribute('class') ?? '';
    if (dataType) return dataType;
    if (className.includes('success')) return 'success';
    if (className.includes('error'))   return 'error';
    if (className.includes('warning')) return 'warning';
    if (className.includes('info'))    return 'info';
    return 'unknown';
  }

  async assertMessage(expected: string | RegExp): Promise<void> {
    await this.waitForToast();
    if (expected instanceof RegExp) {
      const { expect } = await import('@playwright/test');
      expect(await this.getMessage()).toMatch(expected);
    } else {
      await this.assertContainsText(expected);
    }
  }

  async assertType(expected: AlertType): Promise<void> {
    await this.waitForToast();
    const type = await this.getType();
    const { expect } = await import('@playwright/test');
    expect(type).toBe(expected);
  }
}
