import { Step, DataStoreFactory } from 'gauge-ts';
import { Page } from 'playwright';
import { LoginPage }     from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ObservabilityCollector } from '../observability/ObservabilityCollector';

export default class LoginSteps {

  private getPage(): Page                   { return DataStoreFactory.getScenarioDataStore().get('page') as Page; }
  private getObs():  ObservabilityCollector { return DataStoreFactory.getScenarioDataStore().get('obs')  as ObservabilityCollector; }
  private loginPage():     LoginPage     { return new LoginPage(this.getPage(), this.getObs()); }
  private dashboardPage(): DashboardPage { return new DashboardPage(this.getPage(), this.getObs()); }

  @Step('Open the login page')
  async openLoginPage(): Promise<void> {
    await this.loginPage().open();
  }

  @Step('Enter username <username> and password <password>')
  async enterCredentials(username: string, password: string): Promise<void> {
    await this.loginPage().login({ username, password });
  }

  @Step('Click the login button')
  async clickLogin(): Promise<void> {
    // Login is triggered inside login() — this step is declarative in the spec
  }

  @Step('Verify the user is redirected to the dashboard')
  async verifyDashboardRedirect(): Promise<void> {
    await this.loginPage().assertLoginSuccessful();
  }

  @Step('Verify the welcome banner is visible')
  async verifyWelcomeBanner(): Promise<void> {
    await this.dashboardPage().assertOnDashboard();
  }

  @Step('Verify an error message is displayed')
  async verifyErrorMessage(): Promise<void> {
    await this.loginPage().assertLoginFailed();
  }

  @Step('Verify the user remains on the login page')
  async verifyStillOnLoginPage(): Promise<void> {
    await this.loginPage().assertOnLoginPage();
  }

  @Step('Verify username field is visible')
  async verifyUsernameField(): Promise<void> {
    await this.loginPage().usernameInput.assertVisible();
  }

  @Step('Verify password field is visible')
  async verifyPasswordField(): Promise<void> {
    await this.loginPage().passwordInput.assertVisible();
  }

  @Step('Verify login button is visible')
  async verifyLoginButton(): Promise<void> {
    await this.loginPage().loginButton.assertVisible();
  }

  @Step('Click the logout button')
  async clickLogout(): Promise<void> {
    await this.dashboardPage().logout();
  }

  @Step('Verify the user is redirected to the login page')
  async verifyLoginPageRedirect(): Promise<void> {
    await this.loginPage().assertOnLoginPage();
  }
}
