import { Step, DataStoreFactory } from 'gauge-ts';
import { Page } from 'playwright';
import { DashboardPage } from '../pages/DashboardPage';
import { ObservabilityCollector } from '../observability/ObservabilityCollector';

export default class DashboardSteps {

  private getPage(): Page                   { return DataStoreFactory.getScenarioDataStore().get('page') as Page; }
  private getObs():  ObservabilityCollector { return DataStoreFactory.getScenarioDataStore().get('obs')  as ObservabilityCollector; }
  private dashboardPage(): DashboardPage    { return new DashboardPage(this.getPage(), this.getObs()); }

  @Step('Verify the dashboard page has loaded')
  async verifyDashboardLoaded(): Promise<void> {
    await this.dashboardPage().assertOnDashboard();
  }

  @Step('Verify the navigation menu is visible')
  async verifyNavMenu(): Promise<void> {
    await this.dashboardPage().navBar.assertVisible();
  }

  @Step('Verify the user avatar is visible')
  async verifyUserAvatar(): Promise<void> {
    await this.dashboardPage().navBar.assertMenuItemExists('profile');
  }

  @Step('Verify current URL contains <path>')
  async verifyUrlContains(urlPart: string): Promise<void> {
    await this.dashboardPage().assertUrlContains(urlPart);
  }

  @Step('Navigate to section <section>')
  async navigateToSection(section: string): Promise<void> {
    await this.dashboardPage().navigateTo_Section(section);
  }

  @Step('Search for <query> in global search')
  async searchGlobal(query: string): Promise<void> {
    await this.dashboardPage().searchFor(query);
  }
}
