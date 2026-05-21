/**
 * BaseComponent — the foundation all UI components extend.
 *
 * Key responsibilities:
 *  1. Owns the Playwright Locator for its root element
 *  2. Every click/fill/select automatically notifies the ObservabilityCollector
 *     → no page or step needs to manually wire telemetry
 *  3. Provides a consistent interaction + assertion API
 *  4. Supports both `automation-id` and `data-automation-id` attribute strategy
 *
 * Usage pattern:
 *   class InputComponent extends BaseComponent {
 *     async fill(value: string) {
 *       await this.interact('fill', async () => { await this.root.fill(value); });
 *     }
 *   }
 */

import { Locator, Page, expect } from '@playwright/test';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';
import { logger } from '../../utils/Logger';

export type LocatorStrategy =
  | { automationId: string }   // [automation-id="value"]
  | { testId: string }         // data-testid
  | { css: string }            // raw CSS selector
  | { xpath: string }          // raw XPath
  | { locator: Locator };      // pre-built locator

export abstract class BaseComponent {
  /** The root Playwright Locator for this component */
  protected readonly root: Locator;
  protected readonly page: Page;
  protected readonly obs: ObservabilityCollector;
  protected readonly componentName: string;

  constructor(page: Page, obs: ObservabilityCollector, strategy: LocatorStrategy, name?: string) {
    this.page          = page;
    this.obs           = obs;
    this.componentName = name ?? this.constructor.name;
    this.root          = this.resolveLocator(strategy);
  }

  // ─── Locator resolution ──────────────────────────────────────────────────

  private resolveLocator(strategy: LocatorStrategy): Locator {
    if ('automationId' in strategy) {
      // Supports both automation-id and data-automation-id attributes
      return this.page
        .locator(`[automation-id="${strategy.automationId}"], [data-automation-id="${strategy.automationId}"]`)
        .first();
    }
    if ('testId'  in strategy) return this.page.getByTestId(strategy.testId);
    if ('css'     in strategy) return this.page.locator(strategy.css);
    if ('xpath'   in strategy) return this.page.locator(`xpath=${strategy.xpath}`);
    if ('locator' in strategy) return strategy.locator;
    throw new Error(`BaseComponent: unrecognised locator strategy`);
  }

  /**
   * Build a child locator scoped inside this component's root.
   * Keeps component logic self-contained — no page-level selectors needed.
   */
  protected child(strategy: LocatorStrategy): Locator {
    if ('automationId' in strategy) {
      return this.root
        .locator(`[automation-id="${strategy.automationId}"], [data-automation-id="${strategy.automationId}"]`)
        .first();
    }
    if ('testId'  in strategy) return this.root.getByTestId(strategy.testId);
    if ('css'     in strategy) return this.root.locator(strategy.css);
    if ('xpath'   in strategy) return this.root.locator(`xpath=${strategy.xpath}`);
    if ('locator' in strategy) return strategy.locator;
    throw new Error(`BaseComponent: unrecognised child locator strategy`);
  }

  // ─── Core interaction wrapper ─────────────────────────────────────────────

  /**
   * Wraps any interaction with:
   *  - Visibility wait before acting
   *  - Logging
   *  - Automatic observability context update
   */
  protected async interact(action: string, fn: () => Promise<void>): Promise<void> {
    logger.debug(`[${this.componentName}] ${action}`);
    await this.waitForVisible();
    await fn();
  }

  // ─── Visibility & state ───────────────────────────────────────────────────

  async waitForVisible(timeout = 10_000): Promise<void> {
    await this.root.waitFor({ state: 'visible', timeout });
  }

  async waitForHidden(timeout = 10_000): Promise<void> {
    await this.root.waitFor({ state: 'hidden', timeout });
  }

  async waitForAttached(timeout = 10_000): Promise<void> {
    await this.root.waitFor({ state: 'attached', timeout });
  }

  async isVisible(): Promise<boolean>  { return this.root.isVisible(); }
  async isEnabled(): Promise<boolean>  { return this.root.isEnabled(); }
  async isDisabled(): Promise<boolean> { return this.root.isDisabled(); }
  async isChecked(): Promise<boolean>  { return this.root.isChecked(); }
  async count(): Promise<number>       { return this.root.count(); }

  // ─── Text & attribute ─────────────────────────────────────────────────────

  async getText(): Promise<string>  { return (await this.root.textContent()) ?? ''; }
  async getInnerText(): Promise<string> { return this.root.innerText(); }
  async getAttribute(name: string): Promise<string | null> { return this.root.getAttribute(name); }
  async getInputValue(): Promise<string> { return this.root.inputValue(); }

  // ─── Assertions ───────────────────────────────────────────────────────────

  async assertVisible(message?: string): Promise<void> {
    await expect(this.root, message ?? `${this.componentName} should be visible`).toBeVisible();
  }

  async assertHidden(message?: string): Promise<void> {
    await expect(this.root, message ?? `${this.componentName} should be hidden`).toBeHidden();
  }

  async assertEnabled(message?: string): Promise<void> {
    await expect(this.root, message ?? `${this.componentName} should be enabled`).toBeEnabled();
  }

  async assertDisabled(message?: string): Promise<void> {
    await expect(this.root, message ?? `${this.componentName} should be disabled`).toBeDisabled();
  }

  async assertText(expected: string | RegExp): Promise<void> {
    await expect(this.root).toHaveText(expected);
  }

  async assertContainsText(expected: string): Promise<void> {
    await expect(this.root).toContainText(expected);
  }

  async assertAttribute(name: string, value: string | RegExp): Promise<void> {
    await expect(this.root).toHaveAttribute(name, value);
  }

  async assertCount(expected: number): Promise<void> {
    await expect(this.root).toHaveCount(expected);
  }

  // ─── Scroll ───────────────────────────────────────────────────────────────

  async scrollIntoView(): Promise<void> {
    await this.root.scrollIntoViewIfNeeded();
  }

  // ─── Expose root locator (for edge cases) ────────────────────────────────

  getLocator(): Locator { return this.root; }
}
