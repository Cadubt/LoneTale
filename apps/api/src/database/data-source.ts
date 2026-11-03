import { config as loadDotEnv } from 'dotenv';
import { join } from 'node:path';
import { DataSource, type DataSourceOptions } from 'typeorm';

import { LONETALE_SCHEMA, MIGRATIONS_TABLE, loadConfiguration, type DatabaseConfig } from '../config/configuration';
import { LONETALE_ENTITIES } from './entities';

/**
 * Monta as opcoes de conexao com o SQL Server.
 *
 * `synchronize` nunca e ligado: toda mudanca estrutural passa por migration
 * versionada, e a tabela de controle vive dentro do schema `lonetale`.
 */
export function buildDataSourceOptions(
  database: DatabaseConfig,
  options: { forMigrations?: boolean } = {},
): DataSourceOptions {
  // Migrations podem usar credenciais administrativas; a aplicacao roda com o
  // usuario de menor privilegio.
  const credentials =
    options.forMigrations && database.admin
      ? database.admin
      : { username: database.username, password: database.password };

  return {
    type: 'mssql',
    host: database.host,
    port: database.port,
    database: database.database,
    username: credentials.username,
    password: credentials.password,
    schema: LONETALE_SCHEMA,
    synchronize: false,
    migrationsRun: false,
    migrationsTableName: MIGRATIONS_TABLE,
    entities: LONETALE_ENTITIES,
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    logging: database.logging ? ['query', 'error', 'schema'] : ['error'],
    connectionTimeout: database.connectionTimeoutMs,
    requestTimeout: database.requestTimeoutMs,
    pool: {
      max: database.poolMax,
      min: database.poolMin,
      idleTimeoutMillis: 30000,
    },
    options: {
      encrypt: database.encrypt,
      trustServerCertificate: database.trustServerCertificate,
      enableArithAbort: true,
      // Datas sao tratadas em UTC de ponta a ponta.
      useUTC: true,
      ...(database.instanceName ? { instanceName: database.instanceName } : {}),
    },
  };
}

/**
 * DataSource usado pela CLI do TypeORM (`npm run migration:run`).
 *
 * Carregado a partir do .env da raiz do repositorio.
 */
loadDotEnv({ path: join(__dirname, '..', '..', '..', '..', '.env') });

const configuration = loadConfiguration();

export default new DataSource(buildDataSourceOptions(configuration.database, { forMigrations: true }));
