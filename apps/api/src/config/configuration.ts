import { Logger } from '@nestjs/common';

/** Nome do schema dedicado ao LoneTale. Nenhum objeto da aplicacao vive fora dele. */
export const LONETALE_SCHEMA = 'lonetale';

/** Tabela de controle de migrations, mantida dentro do schema do LoneTale. */
export const MIGRATIONS_TABLE = 'MigrationHistory';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  /** Instancia nomeada do SQL Server (opcional; ignora a porta quando usada). */
  instanceName?: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
  connectionTimeoutMs: number;
  requestTimeoutMs: number;
  poolMax: number;
  poolMin: number;
  /** Credenciais administrativas usadas apenas pelas migrations. */
  admin?: { username: string; password: string };
  /**
   * Permite que a aplicacao crie o schema `lonetale` caso ele nao exista.
   * Desligado por padrao: em bancos compartilhados a criacao e um ato
   * deliberado do DBA.
   */
  allowSchemaCreation: boolean;
  logging: boolean;
}

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtl: string;
  refreshTtlDays: number;
  issuer: string;
  audience: string;
}

export interface GoogleConfig {
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  issuer: string;
}

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  port: number;
  globalPrefix: string;
  corsOrigins: string[];
  swaggerEnabled: boolean;
  database: DatabaseConfig;
  jwt: JwtConfig;
  google: GoogleConfig;
  /** Semente fixa para rolagens; use apenas em ambientes de teste. */
  deterministicSeed?: string;
}

const logger = new Logger('Configuration');

function required(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `Variavel de ambiente obrigatoria ausente: ${name}. Consulte .env.example na raiz do repositorio.`,
    );
  }
  return value;
}

function optional(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value;
}

function toInt(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Variavel ${name} deve ser um numero inteiro (recebido: "${value}").`);
  }
  return parsed;
}

function toBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  return ['1', 'true', 'yes', 'y', 'on'].includes(value.trim().toLowerCase());
}

function toList(value: string | undefined, fallback: string[]): string[] {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Le e valida a configuracao a partir do ambiente.
 *
 * Falha no arranque (e nao em producao, no meio de uma requisicao) quando algo
 * essencial esta ausente ou inseguro.
 */
export function loadConfiguration(): AppConfig {
  const env = (process.env.NODE_ENV ?? 'development') as AppConfig['env'];
  const isProduction = env === 'production';

  const adminUser = optional(process.env.DB_ADMIN_USERNAME);
  const adminPassword = optional(process.env.DB_ADMIN_PASSWORD);

  const database: DatabaseConfig = {
    host: required('DB_HOST', process.env.DB_HOST),
    port: toInt('DB_PORT', process.env.DB_PORT, 1433),
    database: required('DB_NAME', process.env.DB_NAME),
    username: required('DB_USERNAME', process.env.DB_USERNAME),
    password: required('DB_PASSWORD', process.env.DB_PASSWORD),
    ...(optional(process.env.DB_INSTANCE_NAME)
      ? { instanceName: optional(process.env.DB_INSTANCE_NAME) as string }
      : {}),
    encrypt: toBool(process.env.DB_ENCRYPT, true),
    trustServerCertificate: toBool(process.env.DB_TRUST_SERVER_CERTIFICATE, !isProduction),
    connectionTimeoutMs: toInt('DB_CONNECTION_TIMEOUT_MS', process.env.DB_CONNECTION_TIMEOUT_MS, 15000),
    requestTimeoutMs: toInt('DB_REQUEST_TIMEOUT_MS', process.env.DB_REQUEST_TIMEOUT_MS, 30000),
    poolMax: toInt('DB_POOL_MAX', process.env.DB_POOL_MAX, 10),
    poolMin: toInt('DB_POOL_MIN', process.env.DB_POOL_MIN, 0),
    ...(adminUser && adminPassword ? { admin: { username: adminUser, password: adminPassword } } : {}),
    allowSchemaCreation: toBool(process.env.DB_ALLOW_SCHEMA_CREATION, false),
    logging: toBool(process.env.DB_LOGGING, false),
  };

  if (isProduction && database.trustServerCertificate && database.encrypt) {
    logger.warn(
      'DB_TRUST_SERVER_CERTIFICATE esta ligado em producao: a criptografia nao valida o certificado do servidor.',
    );
  }

  const accessSecret = required('JWT_ACCESS_SECRET', process.env.JWT_ACCESS_SECRET);
  const refreshSecret = required('JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET);

  if (accessSecret === refreshSecret) {
    throw new Error('JWT_ACCESS_SECRET e JWT_REFRESH_SECRET devem ser diferentes.');
  }
  if (isProduction && (accessSecret.length < 32 || refreshSecret.length < 32)) {
    throw new Error('Em producao, os segredos JWT devem ter ao menos 32 caracteres.');
  }

  const googleClientId = optional(process.env.GOOGLE_CLIENT_ID);
  const googleClientSecret = optional(process.env.GOOGLE_CLIENT_SECRET);
  const googleRedirectUri = optional(process.env.GOOGLE_REDIRECT_URI);
  const googleEnabled = Boolean(googleClientId && googleClientSecret && googleRedirectUri);

  if (!googleEnabled && (googleClientId || googleClientSecret || googleRedirectUri)) {
    logger.warn(
      'Login com Google desativado: informe GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI juntos.',
    );
  }

  const deterministicSeed = optional(process.env.GAME_DETERMINISTIC_SEED);
  if (deterministicSeed && isProduction) {
    throw new Error(
      'GAME_DETERMINISTIC_SEED torna todas as rolagens previsiveis e nao pode ser usada em producao.',
    );
  }

  return {
    env,
    port: toInt('PORT', process.env.PORT, 3333),
    globalPrefix: process.env.API_PREFIX ?? 'api',
    corsOrigins: toList(process.env.CORS_ORIGINS, ['http://localhost:5173']),
    swaggerEnabled: toBool(process.env.SWAGGER_ENABLED, !isProduction),
    database,
    jwt: {
      accessSecret,
      refreshSecret,
      accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
      refreshTtlDays: toInt('JWT_REFRESH_TTL_DAYS', process.env.JWT_REFRESH_TTL_DAYS, 30),
      issuer: process.env.JWT_ISSUER ?? 'lonetale.taverntale.com.br',
      audience: process.env.JWT_AUDIENCE ?? 'lonetale-player',
    },
    google: {
      enabled: googleEnabled,
      ...(googleClientId ? { clientId: googleClientId } : {}),
      ...(googleClientSecret ? { clientSecret: googleClientSecret } : {}),
      ...(googleRedirectUri ? { redirectUri: googleRedirectUri } : {}),
      issuer: process.env.GOOGLE_ISSUER ?? 'https://accounts.google.com',
    },
    ...(deterministicSeed ? { deterministicSeed } : {}),
  };
}
