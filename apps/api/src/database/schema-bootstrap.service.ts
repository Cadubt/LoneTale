import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { LONETALE_SCHEMA, MIGRATIONS_TABLE } from '../config/configuration';
import { AppConfigService } from '../config/app-config.service';

/**
 * Verifica, no arranque, que o LoneTale tem onde viver.
 *
 * Premissas do ambiente: o servidor SQL e o banco de dados ja existem e podem
 * conter objetos de outras aplicacoes. Por isso este servico:
 * - nunca cria banco de dados;
 * - cria o schema `lonetale` somente se ele nao existir E a criacao estiver
 *   explicitamente autorizada por configuracao;
 * - nunca toca em objetos fora do schema `lonetale`;
 * - avisa com instrucoes claras quando falta estrutura, em vez de improvisar.
 */
@Injectable()
export class SchemaBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchemaBootstrapService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: AppConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const exists = await this.schemaExists();

    if (!exists) {
      if (!this.config.database.allowSchemaCreation) {
        this.logger.error(
          `O schema "${LONETALE_SCHEMA}" nao existe no banco "${this.config.database.database}". ` +
            'Crie-o manualmente (CREATE SCHEMA ' +
            LONETALE_SCHEMA +
            ') ou habilite DB_ALLOW_SCHEMA_CREATION=true para que a aplicacao o crie no arranque.',
        );
        return;
      }
      await this.createSchema();
    }

    await this.reportMigrationState();
  }

  private async schemaExists(): Promise<boolean> {
    const rows: Array<{ name: string }> = await this.dataSource.query(
      'SELECT name FROM sys.schemas WHERE name = @0',
      [LONETALE_SCHEMA],
    );
    return rows.length > 0;
  }

  private async createSchema(): Promise<void> {
    try {
      // CREATE SCHEMA precisa ser a unica instrucao do lote, daí o EXEC.
      await this.dataSource.query(
        `IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = '${LONETALE_SCHEMA}') EXEC('CREATE SCHEMA [${LONETALE_SCHEMA}]')`,
      );
      this.logger.log(`Schema "${LONETALE_SCHEMA}" criado.`);
    } catch (error) {
      this.logger.error(
        `Nao foi possivel criar o schema "${LONETALE_SCHEMA}": ${(error as Error).message}. ` +
          'Verifique se o usuario do banco tem permissao CREATE SCHEMA ou crie-o manualmente.',
      );
    }
  }

  private async reportMigrationState(): Promise<void> {
    const rows: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM sys.tables t
         JOIN sys.schemas s ON s.schema_id = t.schema_id
        WHERE s.name = @0 AND t.name = @1`,
      [LONETALE_SCHEMA, MIGRATIONS_TABLE],
    );

    if ((rows[0]?.total ?? 0) === 0) {
      this.logger.warn(
        `Nenhuma migration aplicada ainda (tabela ${LONETALE_SCHEMA}.${MIGRATIONS_TABLE} ausente). ` +
          'Execute "npm run migration:run" antes de usar a API.',
      );
      return;
    }

    const pending = await this.dataSource.showMigrations();
    if (pending) {
      this.logger.warn('Existem migrations pendentes. Execute "npm run migration:run".');
    } else {
      this.logger.log(`Schema "${LONETALE_SCHEMA}" em dia.`);
    }
  }
}
