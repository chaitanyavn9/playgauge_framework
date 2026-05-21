/**
 * DataTableComponent — models any HTML data table or grid.
 * Handles header reading, row access, cell access, sorting, and row assertions.
 *
 * Usage:
 *   const usersTable = new DataTableComponent(page, obs, { automationId: 'users-table' });
 *   const rowCount = await usersTable.getRowCount();
 *   const name = await usersTable.getCellText(0, 'Name');
 *   await usersTable.assertRowContains({ Name: 'John', Role: 'Admin' });
 */

import { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { BaseComponent, LocatorStrategy } from '../base/BaseComponent';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';

export interface RowData { [columnHeader: string]: string; }

export class DataTableComponent extends BaseComponent {
  constructor(
    page: Page,
    obs: ObservabilityCollector,
    strategy: LocatorStrategy,
    name?: string,
  ) {
    super(page, obs, strategy, name ?? 'DataTableComponent');
  }

  // ─── Header helpers ───────────────────────────────────────────────────────

  async getHeaders(): Promise<string[]> {
    const headers = await this.root.locator('thead th, thead [role="columnheader"]').allTextContents();
    return headers.map((h) => h.trim());
  }

  private async getColumnIndex(headerName: string): Promise<number> {
    const headers = await this.getHeaders();
    const index   = headers.indexOf(headerName);
    if (index < 0) throw new Error(`DataTableComponent: column "${headerName}" not found. Available: ${headers.join(', ')}`);
    return index;
  }

  // ─── Row access ───────────────────────────────────────────────────────────

  async getRowCount(): Promise<number> {
    return this.root.locator('tbody tr, [role="row"]:not([aria-label="header"])').count();
  }

  getRow(rowIndex: number): Locator {
    return this.root
      .locator('tbody tr, [role="row"]:not([aria-label="header"])')
      .nth(rowIndex);
  }

  async getRowData(rowIndex: number): Promise<RowData> {
    const headers = await this.getHeaders();
    const cells   = await this.getRow(rowIndex)
      .locator('td, [role="cell"]')
      .allTextContents();
    const data: RowData = {};
    headers.forEach((h, i) => { data[h] = (cells[i] ?? '').trim(); });
    return data;
  }

  async getAllRows(): Promise<RowData[]> {
    const count = await this.getRowCount();
    return Promise.all(Array.from({ length: count }, (_, i) => this.getRowData(i)));
  }

  // ─── Cell access ─────────────────────────────────────────────────────────

  async getCellText(rowIndex: number, columnHeader: string): Promise<string> {
    const colIndex = await this.getColumnIndex(columnHeader);
    const cell     = this.getRow(rowIndex).locator('td, [role="cell"]').nth(colIndex);
    return (await cell.textContent() ?? '').trim();
  }

  async getCellLocator(rowIndex: number, columnHeader: string): Promise<Locator> {
    const colIndex = await this.getColumnIndex(columnHeader);
    return this.getRow(rowIndex).locator('td, [role="cell"]').nth(colIndex);
  }

  // ─── Sorting ──────────────────────────────────────────────────────────────

  async sortByColumn(headerName: string): Promise<void> {
    await this.interact(`sortBy:${headerName}`, async () => {
      const headers = this.root.locator('thead th, [role="columnheader"]');
      const count   = await headers.count();
      const texts   = await headers.allTextContents();
      const idx     = texts.findIndex((t) => t.trim() === headerName);
      if (idx < 0) throw new Error(`Column "${headerName}" not found for sorting`);
      await headers.nth(idx).click();
    });
  }

  async getSortDirection(headerName: string): Promise<'asc' | 'desc' | 'none'> {
    const headers = this.root.locator('thead th, [role="columnheader"]');
    const texts   = await headers.allTextContents();
    const idx     = texts.findIndex((t) => t.trim() === headerName);
    if (idx < 0) return 'none';
    const header  = headers.nth(idx);
    const ariaSort = await header.getAttribute('aria-sort');
    if (ariaSort === 'ascending')  return 'asc';
    if (ariaSort === 'descending') return 'desc';
    return 'none';
  }

  // ─── Row click ────────────────────────────────────────────────────────────

  async clickRow(rowIndex: number): Promise<void> {
    await this.interact(`clickRow:${rowIndex}`, async () => {
      await this.getRow(rowIndex).click();
    });
  }

  async clickActionInRow(rowIndex: number, actionAutomationId: string): Promise<void> {
    await this.interact(`clickRowAction:${actionAutomationId}`, async () => {
      await this.getRow(rowIndex)
        .locator(`[automation-id="${actionAutomationId}"], [data-automation-id="${actionAutomationId}"]`)
        .click();
    });
  }

  // ─── Search within table ──────────────────────────────────────────────────

  async findRowByColumnValue(columnHeader: string, value: string): Promise<number> {
    const count = await this.getRowCount();
    for (let i = 0; i < count; i++) {
      const cellText = await this.getCellText(i, columnHeader);
      if (cellText === value) return i;
    }
    return -1;
  }

  // ─── Assertions ───────────────────────────────────────────────────────────

  async assertRowCount(expected: number): Promise<void> {
    const count = await this.getRowCount();
    expect(count).toBe(expected);
  }

  async assertEmpty(): Promise<void> {
    const emptyState = this.root.locator('[automation-id="table-empty"], .empty-state, [data-empty]');
    await expect(emptyState.or(this.root.locator('tbody tr:has-text("No data"), tbody tr:has-text("No results")'))).toBeVisible();
  }

  async assertRowContains(expected: Partial<RowData>): Promise<void> {
    const count = await this.getRowCount();
    for (let i = 0; i < count; i++) {
      const row = await this.getRowData(i);
      const matches = Object.entries(expected).every(
        ([col, val]) => row[col]?.includes(val ?? ''),
      );
      if (matches) return;
    }
    throw new Error(`DataTableComponent: no row found matching ${JSON.stringify(expected)}`);
  }

  async assertColumnExists(headerName: string): Promise<void> {
    const headers = await this.getHeaders();
    expect(headers).toContain(headerName);
  }

  async assertCellText(rowIndex: number, columnHeader: string, expected: string | RegExp): Promise<void> {
    const text = await this.getCellText(rowIndex, columnHeader);
    if (expected instanceof RegExp) {
      expect(text).toMatch(expected);
    } else {
      expect(text).toBe(expected);
    }
  }
}
