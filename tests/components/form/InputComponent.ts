/**
 * InputComponent — models any text input, textarea, or search field.
 *
 * Usage:
 *   const username = new InputComponent(page, obs, { automationId: 'login-username' }, 'Username');
 *   await username.fill('john_doe');
 *   await username.assertValue('john_doe');
 */

import { Page } from '@playwright/test';
import { BaseComponent, LocatorStrategy } from '../base/BaseComponent';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';
import { logger } from '../../utils/Logger';

export class InputComponent extends BaseComponent {
  constructor(
    page: Page,
    obs: ObservabilityCollector,
    strategy: LocatorStrategy,
    name?: string,
  ) {
    super(page, obs, strategy, name ?? 'InputComponent');
  }

  /** Clear existing value and type a new one */
  async fill(value: string | number): Promise<void> {
    const strValue = String(value);   // gauge passes numeric-looking params as numbers
    await this.interact('fill', async () => {
      await this.root.clear();
      await this.root.fill(strValue);
      logger.debug(`[${this.componentName}] filled with value`);
    });
  }

  /** Type character-by-character — useful for autocomplete fields */
  async type(value: string | number, delayMs = 50): Promise<void> {
    const strValue = String(value);
    await this.interact('type', async () => {
      await this.root.clear();
      await this.root.pressSequentially(strValue, { delay: delayMs });
    });
  }

  /** Clear the field */
  async clear(): Promise<void> {
    await this.interact('clear', async () => {
      await this.root.clear();
    });
  }

  /** Press a key (e.g. 'Enter', 'Tab', 'Escape') */
  async pressKey(key: string): Promise<void> {
    await this.interact(`press:${key}`, async () => {
      await this.root.press(key);
    });
  }

  async fillAndSubmit(value: string): Promise<void> {
    await this.fill(value);
    await this.pressKey('Enter');
  }

  async getValue(): Promise<string> {
    return this.root.inputValue();
  }

  async assertValue(expected: string | RegExp): Promise<void> {
    const { expect } = await import('@playwright/test');
    await expect(this.root).toHaveValue(expected);
  }

  async assertPlaceholder(expected: string): Promise<void> {
    await this.assertAttribute('placeholder', expected);
  }

  async assertReadOnly(): Promise<void> {
    await this.assertAttribute('readonly', /.*/);
  }

  async assertMaxLength(length: number): Promise<void> {
    await this.assertAttribute('maxlength', String(length));
  }
}
