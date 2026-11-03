import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppConfigModule } from '../config/config.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { GoogleAuthService } from './google.service';
import { JwtStrategy } from './jwt.strategy';
import { PasswordModule } from './password.module';
import { TokenService } from './token.service';

@Module({
  imports: [
    AppConfigModule,
    PasswordModule,
    UsersModule,
    PassportModule,
    // Os segredos sao informados por chamada (acesso, renovacao e fluxo OIDC
    // usam chaves distintas), por isso o modulo e registrado sem segredo global.
    JwtModule.register({}),
    TypeOrmModule.forFeature([RefreshToken]),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, GoogleAuthService, JwtStrategy],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
