import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { join } from 'node:path';

import { AppConfigService } from './app-config.service';

/**
 * Carrega o .env da raiz do monorepo e expoe a configuracao tipada
 * globalmente, para que nenhum modulo precise ler `process.env` diretamente.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [
        join(process.cwd(), '.env'),
        join(process.cwd(), '..', '..', '.env'),
      ],
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
