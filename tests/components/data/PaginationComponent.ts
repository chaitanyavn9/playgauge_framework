/**
 * PaginationComponent — models any pagination control.
 *
 * Usage:
 *   const pagination = new PaginationComponent(page, obs, { automationId: 'users-pagination' });
 *   await pagination.nextPage();
 *   await pagination.assertCurrentPage(2);
 */

import { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BaseComponent, LocatorStrategy } from '../base/BaseComponent';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';

export class PaginationComponent extends BaseComponent {
  constructor(
    page: Page,
    obs: ObservabilityCollector,
    strategy: LocatorStrategy,
    name?: string,
  ) {
    super(page, obs, strategy, name ?? 'PaginationComponent');
  }

  async nextPage(): Promise<void> {
    await this.interact('nextPage', async () => {
      await this.root
        .locator('[automation-id="pagination-next"], [aria-label="Next page"], button:has-text("Next")')
        .first()
        .click();
    });
  }

  async prevPage(): Promise<void> {
    await this.interact('prevPage', async () => {
      await this.root
        .locator('[automation-id="pagination-prev"], [aria-label="Previous page"], button:has-text("Previous")')
        .first()
        .click();
    });
  }

  async goToPage(pageNumber: number): Promise<void> {
    await this.interact(`goToPage:${pageNumber}`, async () => {
      const pageBtn = this.root.locator(`[aria-label="Page ${pageNumber}"], button:text-is("${pageNumber}")`).first();
      await pageBtn.click();
    });
  }

  async goToFirstPage(): Promise<void> {
    await this.interact('firstPage', async () => {
      await this.root
        .locator('[automation-id="pagination-first"], [aria-label="First page"]')
        .first()
        .click();
    });
  }

  async goToLastPage(): Promise<void> {
    await this.interact('lastPage', async () => {
      await this.root
        .locator('[automation-id="pagination-last"], [aria-label="Last page"]')
        .first()
        .click();
    });
  }

  async getCurrentPage(): Promise<number> {
    const text = await this.root
      .locator('[aria-current="page"], .active-page, [data-current]')
      .first()
      .textContent();
    return parseInt(text ?? '1', 10);
  }

  async getTotalPages(): Promise<number> {
    const text = await this.root
      .locator('[automation-id="pagination-total"], [data-total-pages]')
      .first()
      .textContent();
    return parseInt(text ?? '0', 10);
  }

  async isNextDisabled(): Promise<boolean> {
    return this.root
      .locator('[automation-id="pagination-next"], [aria-label="Next page"]')
      .first()
      .isDisabled();
  }

  async isPrevDisabled(): Promise<boolean> {
    return this.root
      .locator('[automation-id="pagination-prev"], [aria-label="Previous page"]')
      .first()
      .isDisabled();
  }

  async assertCurrentPage(expected: number): Promise<void> {
    const current = await this.getCurrentPage();
    expect(current).toBe(expected);
  }

  async assertNextEnabled(): Promise<void> {
    expect(await this.isNextDisabled()).toBe(false);
  }

  async assertNextDisabled(): Promise<void> {
    expect(await this.isNextDisabled()).toBe(true);
  }
}
