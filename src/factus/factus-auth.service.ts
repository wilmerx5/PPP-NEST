import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FactusOAuthTokenResponse } from './types/factus.types';

@Injectable()
export class FactusAuthService {
  private readonly logger = new Logger(FactusAuthService.name);
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAtMs = 0;

  constructor(private readonly config: ConfigService) {}

  getBaseUrl(): string {
    const env = (this.config.get<string>('FACTUS_ENV') || 'sandbox').toLowerCase();
    if (env === 'production' || env === 'prod') {
      return 'https://api.factus.com.co';
    }
    return 'https://api-sandbox.factus.com.co';
  }

  isConfigured(): boolean {
    return !!(
      this.config.get<string>('FACTUS_CLIENT_ID')?.trim() &&
      this.config.get<string>('FACTUS_CLIENT_SECRET')?.trim() &&
      this.config.get<string>('FACTUS_USERNAME')?.trim() &&
      this.config.get<string>('FACTUS_PASSWORD')?.trim()
    );
  }

  async getAccessToken(): Promise<string> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Factus no está configurado. Define FACTUS_CLIENT_ID, FACTUS_CLIENT_SECRET, FACTUS_USERNAME y FACTUS_PASSWORD.',
      );
    }

    const skewMs = 60_000;
    if (this.accessToken && Date.now() < this.expiresAtMs - skewMs) {
      return this.accessToken;
    }

    if (this.refreshToken) {
      try {
        return await this.refreshAccessToken();
      } catch (err) {
        this.logger.warn(`Refresh Factus falló, reautenticando: ${(err as Error).message}`);
      }
    }

    return this.fetchPasswordToken();
  }

  invalidateToken(): void {
    this.accessToken = null;
    this.expiresAtMs = 0;
  }

  private async fetchPasswordToken(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: this.config.get<string>('FACTUS_CLIENT_ID')!.trim(),
      client_secret: this.config.get<string>('FACTUS_CLIENT_SECRET')!.trim(),
      username: this.config.get<string>('FACTUS_USERNAME')!.trim(),
      password: this.config.get<string>('FACTUS_PASSWORD')!.trim(),
    });

    const res = await fetch(`${this.getBaseUrl()}/oauth/token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(`Factus OAuth error ${res.status}: ${errText}`);
      throw new ServiceUnavailableException(
        'No se pudo autenticar con Factus. Revisa credenciales / sandbox.',
      );
    }

    const data = (await res.json()) as FactusOAuthTokenResponse;
    this.storeTokens(data);
    return this.accessToken!;
  }

  private async refreshAccessToken(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.get<string>('FACTUS_CLIENT_ID')!.trim(),
      client_secret: this.config.get<string>('FACTUS_CLIENT_SECRET')!.trim(),
      refresh_token: this.refreshToken!,
    });

    const res = await fetch(`${this.getBaseUrl()}/oauth/token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!res.ok) {
      this.refreshToken = null;
      throw new Error(`refresh failed ${res.status}`);
    }

    const data = (await res.json()) as FactusOAuthTokenResponse;
    this.storeTokens(data);
    return this.accessToken!;
  }

  private storeTokens(data: FactusOAuthTokenResponse): void {
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token || this.refreshToken;
    const expiresIn = Number(data.expires_in) || 3600;
    this.expiresAtMs = Date.now() + expiresIn * 1000;
  }
}
