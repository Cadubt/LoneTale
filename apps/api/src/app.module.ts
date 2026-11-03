import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AdventuresModule } from './adventures/adventures.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards';
import { EngineExceptionFilter } from './common/engine-exception.filter';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { GameModule } from './game/game.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    // Limite base; rotas sensiveis (login, registro) apertam com @Throttle.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    UsersModule,
    AuthModule,
    AdventuresModule,
    GameModule,
    HealthModule,
  ],
  providers: [
    // Autenticacao fechada por padrao: rotas abertas precisam de @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: EngineExceptionFilter },
  ],
})
export class AppModule {}
