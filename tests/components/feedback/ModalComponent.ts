/**
 * ModalComponent — models dialog modals, confirmation popups, and side drawers.
 *
 * Usage:
 *   const deleteModal = new ModalComponent(page, obs, { automationId: 'delete-confirm-modal' });
 *   await deleteModal.waitForOpen();
 *   await deleteModal.assertTitle('Confirm Delete');
 *   await deleteModal.confirm();   // click primary action button
 */

import { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BaseComponent, LocatorStrategy } from '../base/BaseComponent';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';

export class ModalComponent extends BaseComponent {
  constructor(
    page: Page,
    obs: ObservabilityCollector,
    strategy: LocatorStrategy,
    name?: string,
  ) {
    super(page, obs, strategy, name ?? 'ModalComponent');
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async waitForOpen(timeout = 10_000): Promise<void> {
    await this.root.waitFor({ state: 'visible', timeout });
    // Also wait for transition to complete
    await this.page.waitForTimeout(150);
  }

  async waitForClose(timeout = 10_000): Promise<void> {
    await this.root.waitFor({ state: 'hidden', timeout });
  }

  async isOpen(): Promise<boolean> {
    return this.root.isVisible();
  }

  // ─── Actions ─────────────────────────────────────────────────────────────

  /** Click the primary/confirm action button (e.g. "Delete", "Save", "Confirm") */
  async confirm(): Promise<void> {
    await this.interact('confirm', async () => {
      await this.root
        .locator('[automation-id="modal-confirm"], [automation-id="modal-primary"], button[data-action="confirm"], button.btn-primary')
        .first()
        .click();
    });
  }

  /** Click the cancel/close action button */
  async cancel(): Promise<void> {
    await this.interact('cancel', async () => {
      await this.root
        .locator('[automation-id="modal-cancel"], [automation-id="modal-close"], button[data-action="cancel"], button.btn-secondary')
        .first()
        .click();
    });
  }

  /** Close modal via the X button in the header */
  async closeViaX(): Promise<void> {
    await this.interact('closeViaX', async () => {
      await this.root
        .locator('[automation-id="modal-x"], [aria-label="Close modal"], [aria-label="Close dialog"], button.close')
        .first()
        .click();
    });
  }

  /** Close modal by pressing Escape */
  async closeViaEscape(): Promise<void> {
    await this.interact('closeViaEscape', async () => {
      await this.page.keyboard.press('Escape');
    });
  }

  /** Close modal by clicking the backdrop overlay */
  async closeViaBackdrop(): Promise<void> {
    await this.interact('closeViaBackdrop', async () => {
      await this.page
        .locator('[automation-id="modal-backdrop"], .modal-overlay, [aria-modal="true"] + div')
        .first()
        .click({ position: { x: 5, y: 5 } }); // click top-left corner of backdrop
    });
  }

  // ─── Content access ───────────────────────────────────────────────────────

  async getTitle(): Promise<string> {
    return (await this.root
      .locator('[automation-id="modal-title"], .modal-title, h2, h3, [role="heading"]')
      .first()
      .textContent() ?? '').trim();
  }

  async getBodyText(): Promise<string> {
    return (await this.root
      .locator('[automation-id="modal-body"], .modal-body, [role="dialog"] p')
      .first()
      .textContent() ?? '').trim();
  }

  // ─── Assertions ───────────────────────────────────────────────────────────

  async assertOpen(): Promise<void> {
    await expect(this.root).toBeVisible();
  }

  async assertClosed(): Promise<void> {
    await expect(this.root).toBeHidden();
  }

  async assertTitle(expected: string | RegExp): Promise<void> {
    const title = await this.getTitle();
    if (expected instanceof RegExp) {
      expect(title).toMatch(expected);
    } else {
      expect(title).toBe(expected);
    }
  }

  async assertBodyContains(expected: string): Promise<void> {
    const body = await this.getBodyText();
    expect(body).toContain(expected);
  }
}
