import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { CurrentUser, Public } from './decorators';
import {
  AuthenticatedUserDto,
  ChangePasswordDto,
  GoogleAuthorizationResponseDto,
  GoogleCallbackDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  SessionResponseDto,
} from './dto/auth.dto';
import type { RequestUser } from './jwt.strategy';
import type { TokenClientInfo } from './token.service';

function clientInfo(request: Request): TokenClientInfo {
  const forwarded = request.headers['x-forwarded-for'];
  const ip =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()) ??
    request.ip ??
    undefined;
  const userAgent = request.headers['user-agent'];
  return {
    ...(ip ? { ip } : {}),
    ...(typeof userAgent === 'string' ? { userAgent } : {}),
  };
}

@ApiTags('Autenticacao')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Cria uma conta local e devolve a sessao.' })
  @ApiResponse({ status: 201, type: SessionResponseDto })
  register(@Body() dto: RegisterDto, @Req() request: Request): Promise<SessionResponseDto> {
    return this.auth.register(dto, clientInfo(request));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Autentica com e-mail e senha.' })
  @ApiResponse({ status: 200, type: SessionResponseDto })
  login(@Body() dto: LoginDto, @Req() request: Request): Promise<SessionResponseDto> {
    return this.auth.login(dto, clientInfo(request));
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Renova a sessao, rotacionando o token de renovacao.',
    description:
      'O token antigo e revogado. Reapresentar um token ja usado revoga toda a familia de sessoes, por seguranca.',
  })
  @ApiResponse({ status: 200, type: SessionResponseDto })
  refresh(@Body() dto: RefreshDto, @Req() request: Request): Promise<SessionResponseDto> {
    return this.auth.refresh(dto.refreshToken, clientInfo(request));
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoga o token de renovacao informado.' })
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @Post('logout-all')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Encerra a sessao em todos os aparelhos.' })
  async logoutAll(@CurrentUser('id') userId: string): Promise<void> {
    await this.auth.logoutAll(userId);
  }

  @Public()
  @Get('google/url')
  @ApiOperation({
    summary: 'Inicia o login com Google (OpenID Connect).',
    description:
      'Devolve a URL de autorizacao e um token de fluxo de vida curta que carrega state, nonce e o verificador PKCE. Envie o token de volta no callback.',
  })
  @ApiResponse({ status: 200, type: GoogleAuthorizationResponseDto })
  googleUrl(): Promise<GoogleAuthorizationResponseDto> {
    return this.auth.getGoogleAuthorization();
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('google/callback')
  @HttpCode(200)
  @ApiOperation({ summary: 'Conclui o login com Google e devolve a sessao.' })
  @ApiResponse({ status: 200, type: SessionResponseDto })
  googleCallback(
    @Body() dto: GoogleCallbackDto,
    @Req() request: Request,
  ): Promise<SessionResponseDto> {
    return this.auth.loginWithGoogle(dto.code, dto.state, dto.flowToken, clientInfo(request));
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dados do usuario autenticado.' })
  @ApiResponse({ status: 200, type: AuthenticatedUserDto })
  me(@CurrentUser() user: RequestUser): AuthenticatedUserDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  }

  @Post('change-password')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Troca a senha e encerra as demais sessoes.',
  })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.auth.changePassword(userId, dto);
  }
}
