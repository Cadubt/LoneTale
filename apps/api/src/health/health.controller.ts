import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { CURRENT_SCHEMA_VERSION } from '@lonetale/engine';
import { DataSource } from 'typeorm';

import { Public } from '../auth/decorators';
import { LONETALE_SCHEMA } from '../config/configuration';
import { AppConfigService } from '../config/app-config.service';

@ApiTags('Saude')
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Verificacao rapida de disponibilidade.' })
  live() {
    return {
      status: 'ok',
      service: 'lonetale-api',
      environment: this.config.env,
      adventureSchemaVersion: CURRENT_SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('ready')
  @ApiOperation({
    summary: 'Verificacao de prontidao: conexao com o SQL Server e schema aplicado.',
  })
  async ready() {
    const checks: Record<string, { ok: boolean; detail?: string }> = {};

    try {
      await this.dataSource.query('SELECT 1 AS ok');
      checks.database = { ok: true };
    } catch (error) {
      checks.database = { ok: false, detail: (error as Error).message };
    }

    if (checks.database.ok) {
      try {
        const rows: Array<{ total: number }> = await this.dataSource.query(
          `SELECT COUNT(*) AS total FROM sys.tables t
             JOIN sys.schemas s ON s.schema_id = t.schema_id
            WHERE s.name = @0`,
          [LONETALE_SCHEMA],
        );
        const total = rows[0]?.total ?? 0;
        checks.schema = {
          ok: total > 0,
          detail: `${total} tabela(s) no schema ${LONETALE_SCHEMA}`,
        };
        const pending = await this.dataSource.showMigrations();
        checks.migrations = {
          ok: !pending,
          ...(pending ? { detail: 'Existem migrations pendentes.' } : {}),
        };
      } catch (error) {
        checks.schema = { ok: false, detail: (error as Error).message };
      }
    }

    const ok = Object.values(checks).every((check) => check.ok);
    return { status: ok ? 'ready' : 'degraded', checks };
  }
}
