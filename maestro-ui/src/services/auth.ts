import { UiPath } from '@uipath/uipath-typescript/core';

export interface UiPathConfig {
  baseUrl: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  orgName: string;
  tenantName: string;
}

export class AuthService {
  private sdk: UiPath | null = null;
  private config: UiPathConfig;

  constructor(config: UiPathConfig) {
    this.config = config;
  }

  async initialize(): Promise<UiPath> {
    if (this.sdk) {
      return this.sdk;
    }

    this.sdk = new UiPath({
      baseUrl: this.config.baseUrl,
      orgName: this.config.orgName,
      tenantName: this.config.tenantName,
      clientId: this.config.clientId,
      redirectUri: this.config.redirectUri,
      scope: this.config.scope,
    });

    await this.sdk.initialize();
    return this.sdk;
  }

  getSDK(): UiPath | null {
    return this.sdk;
  }

  isAuthenticated(): boolean {
    return this.sdk !== null;
  }

  async logout(): Promise<void> {
    if (this.sdk) {
      await this.sdk.logout();
      this.sdk = null;
    }
  }
}

export const authService = new AuthService({
  baseUrl: import.meta.env.VITE_UIPATH_BASE_URL || '',
  clientId: import.meta.env.VITE_UIPATH_CLIENT_ID || '',
  redirectUri: import.meta.env.VITE_UIPATH_REDIRECT_URI || '',
  scope: import.meta.env.VITE_UIPATH_SCOPE || '',
  orgName: import.meta.env.VITE_UIPATH_ORG_NAME || '',
  tenantName: import.meta.env.VITE_UIPATH_TENANT_NAME || '',
});
