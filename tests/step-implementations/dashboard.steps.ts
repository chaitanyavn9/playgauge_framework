import { Step, DataStore } from 'gauge-ts';
import { Page } from 'playwright';
import { DashboardPage } from '../pages/DashboardPage';
import { ObservabilityCollector } from '../observability/ObservabilityCollector';

function getPage(): Page                   { return DataStore.ScenarioDataStore.get('page') as Page; }
function getObs():  ObservabilityCollector { return DataStore.ScenarioDataStore.get('obs')  as ObservabilityCollector; }
function dashboardPage(): DashboardPage    { return new DashboardPage(getPage(), getObs()); }

@Step('Verify the dashboard page has loaded')
async function verifyDashboardLoaded(): Promise<void> {
  await dashboardPage().assertOnDashboard();
}

@Step('Verify the navigation menu is visible')
async function verifyNavMenu(): Promise<void> {
  await dashboardPage().navBar.assertVisible();
}

@Step('Verify the user avatar is visible')
async function verifyUserAvatar(): Promise<void> {
  await dashboardPage().navBar.assertMenuItemExists('profile');
}

@Step('Verify current URL contains <path>')
async function verifyUrlContains(urlPart: string): Promise<void> {
  await dashboardPage().assertUrlContains(urlPart);
}

@Step('Navigate to section <section>')
async function navigateToSection(section: string): Promise<void> {
  await dashboardPage().navigateTo_Section(section);
}

@Step('Search for <query> in global search')
async function searchGlobal(query: string): Promise<void> {
  await dashboardPage().searchFor(query);
}
