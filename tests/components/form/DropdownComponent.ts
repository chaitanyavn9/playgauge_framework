/**
 * DropdownComponent — models native <select> and custom dropdown widgets.
 * Handles both HTML select elements and custom div/ul-based dropdowns.
 *
 * Usage:
 *   const roleDropdown = new DropdownComponent(page, obs, { automationId: 'role-select' }, 'Role');
 *   await roleDropdown.selectByText('Admin');
 *   await roleDropdown.assertSelected('Admin');
 */

import { Page } from '@playwright/test';
import { BaseComponent, LocatorStrategy } from '../base/BaseComponent';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';
import { expect } from '@playwright/test';

export type DropdownType = 'native' | 'custom';

export class DropdownComponent extends BaseComponent {
  private readonly dropdownType: DropdownType;

  constructor(
    page: Page,
    obs: ObservabilityCollector,
    strategy: LocatorStrategy,
    name?: string,
    type: DropdownType = 'native',
  ) {
    super(page, obs, strategy, name ?? 'DropdownComponent');
    this.dropdownType = type;
  }

  // ─── Native <select> methods ──────────────────────────────────────────────

  async selectByText(optionText: string): Promise<void> {
    await this.interact(`selectByText:${optionText}`, async () => {
      if (this.dropdownType === 'native') {
        await this.root.selectOption({ label: optionText });
      } else {
        await this.openDropdown();
        await this.page
          .locator(`[role="option"]:has-text("${optionText}"), li:has-text("${optionText}")`)
          .first()
          .click();
      }
    });
  }

  async selectByValue(value: string): Promise<void> {
    await this.interact(`selectByValue:${value}`, async () => {
      if (this.dropdownType === 'native') {
        await this.root.selectOption({ value });
      } else {
        await this.openDropdown();
        await this.page
          .locator(`[data-value="${value}"], [value="${value}"]`)
          .first()
          .click();
      }
    });
  }

  async selectByIndex(index: number): Promise<void> {
    await this.interact(`selectByIndex:${index}`, async () => {
      if (this.dropdownType === 'native') {
        await this.root.selectOption({ index });
      } else {
        await this.openDropdown();
        const options = this.page.locator('[role="option"], li[data-option]');
        await options.nth(index).click();
      }
    });
  }

  // ─── Custom dropdown helpers ──────────────────────────────────────────────

  async openDropdown(): Promise<void> {
    const isOpen = await this.isDropdownOpen();
    if (!isOpen) await this.root.click();
  }

  async closeDropdown(): Promise<void> {
    const isOpen = await this.isDropdownOpen();
    if (isOpen) await this.root.press('Escape');
  }

  private async isDropdownOpen(): Promise<boolean> {
    const expanded = await this.root.getAttribute('aria-expanded');
    return expanded === 'true';
  }

  // ─── Search inside dropdown ───────────────────────────────────────────────

  async searchAndSelect(searchText: string): Promise<void> {
    await this.openDropdown();
    const searchInput = this.root.locator('input[type="text"], input[type="search"]').first();
    await searchInput.fill(searchText);
    await this.page
      .locator(`[role="option"]:has-text("${searchText}")`)
      .first()
      .click();
  }

  // ─── Read state ───────────────────────────────────────────────────────────

  async getSelectedText(): Promise<string> {
    if (this.dropdownType === 'native') {
      return this.root.evaluate((el) => {
        const select = el as HTMLSelectElement;
        return select.options[select.selectedIndex]?.text ?? '';
      });
    }
    return (await this.root.textContent()) ?? '';
  }

  async getAllOptions(): Promise<string[]> {
    if (this.dropdownType === 'native') {
      return this.root.evaluate((el) =>
        Array.from((el as HTMLSelectElement).options).map((o) => o.text),
      );
    }
    await this.openDropdown();
    const options = await this.page.locator('[role="option"]').allTextContents();
    await this.closeDropdown();
    return options;
  }

  // ─── Assertions ───────────────────────────────────────────────────────────

  async assertSelected(expected: string): Promise<void> {
    const selected = await this.getSelectedText();
    expect(selected).toBe(expected);
  }

  async assertOptionsContain(option: string): Promise<void> {
    const options = await this.getAllOptions();
    expect(options).toContain(option);
  }

  async assertOptionCount(count: number): Promise<void> {
    const options = await this.getAllOptions();
    expect(options).toHaveLength(count);
  }
}
