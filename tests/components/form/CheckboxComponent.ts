/**
 * CheckboxComponent — models checkboxes, radio buttons, and toggle switches.
 *
 * Usage:
 *   const rememberMe = new CheckboxComponent(page, obs, { automationId: 'remember-me' });
 *   await rememberMe.check();
 *   await rememberMe.assertChecked();
 */

import { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BaseComponent, LocatorStrategy } from '../base/BaseComponent';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';

export class CheckboxComponent extends BaseComponent {
  constructor(
    page: Page,
    obs: ObservabilityCollector,
    strategy: LocatorStrategy,
    name?: string,
  ) {
    super(page, obs, strategy, name ?? 'CheckboxComponent');
  }

  async check(): Promise<void> {
    await this.interact('check', async () => {
      await this.root.check();
    });
  }

  async uncheck(): Promise<void> {
    await this.interact('uncheck', async () => {
      await this.root.uncheck();
    });
  }

  async toggle(): Promise<void> {
    const checked = await this.isChecked();
    checked ? await this.uncheck() : await this.check();
  }

  async setChecked(state: boolean): Promise<void> {
    await this.interact(`setChecked:${state}`, async () => {
      await this.root.setChecked(state);
    });
  }

  async assertChecked(): Promise<void> {
    await expect(this.root).toBeChecked();
  }

  async assertUnchecked(): Promise<void> {
    await expect(this.root).not.toBeChecked();
  }
}
