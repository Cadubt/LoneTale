import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/app-config.service';
import { buildDataSourceOptions } from './data-source';
import { SchemaBootstrapService } from './schema-bootstrap.service';

@Module({
  imports: [
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        buildDataSourceOptions(config.database, { forMigrations: false }),
    }),
  ],
  providers: [SchemaBootstrapService],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
