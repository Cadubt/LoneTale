import { Injectable } from '@nestjs/common';

import { loadConfiguration, type AppConfig, type DatabaseConfig, type GoogleConfig, type JwtConfig } from './configuration';

/**
 * Configuracao tipada da aplicacao.
 *
 * Carregada e validada uma unica vez, no arranque: se algo essencial faltar, o
 * processo nao sobe -- em vez de falhar no meio de uma requisicao em producao.
 */
@Injectable()
export class AppConfigService {
  private readonly config: AppConfig;

  constructor() {
    this.config = loadConfiguration();
  }

  get all(): AppConfig {
    return this.config;
  }

  get env(): AppConfig['env'] {
    return this.config.env;
  }

  get isProduction(): boolean {
    return this.config.env === 'production';
  }

  get port(): number {
    return this.config.port;
  }

  get globalPrefix(): string {
    return this.config.globalPrefix;
  }

  get corsOrigins(): string[] {
    return this.config.corsOrigins;
  }

  get swaggerEnabled(): boolean {
    return this.config.swaggerEnabled;
  }

  get database(): DatabaseConfig {
    return this.config.database;
  }

  get jwt(): JwtConfig {
    return this.config.jwt;
  }

  get google(): GoogleConfig {
    return this.config.google;
  }

  get deterministicSeed(): string | undefined {
    return this.config.deterministicSeed;
  }
}
