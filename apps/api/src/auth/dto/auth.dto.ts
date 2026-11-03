import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'jogador@exemplo.com', maxLength: 320 })
  @IsEmail({}, { message: 'Informe um e-mail valido.' })
  @MaxLength(320)
  email: string;

  @ApiProperty({ example: 'Ysolde das Cinzas', minLength: 2, maxLength: 80 })
  @IsString()
  @IsNotEmpty({ message: 'Informe um nome de exibicao.' })
  @MinLength(2)
  @MaxLength(80)
  displayName: string;

  @ApiProperty({
    minLength: 10,
    maxLength: 128,
    description: 'Ao menos 10 caracteres, com letras e numeros.',
  })
  @IsString()
  @MinLength(10, { message: 'A senha deve ter ao menos 10 caracteres.' })
  @MaxLength(128)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'A senha deve conter letras e numeros.',
  })
  password: string;
}

export class LoginDto {
  @ApiProperty({ example: 'jogador@exemplo.com' })
  @IsEmail({}, { message: 'Informe um e-mail valido.' })
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'Token de renovacao recebido no login.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  refreshToken: string;
}

export class GoogleCallbackDto {
  @ApiProperty({ description: 'Codigo de autorizacao devolvido pelo Google.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  code: string;

  @ApiProperty({ description: 'Parametro "state" devolvido pelo Google.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  state: string;

  @ApiProperty({ description: 'Token de fluxo recebido ao iniciar o login.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  flowToken: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword: string;

  @ApiProperty({ minLength: 10, maxLength: 128 })
  @IsString()
  @MinLength(10, { message: 'A senha deve ter ao menos 10 caracteres.' })
  @MaxLength(128)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'A senha deve conter letras e numeros.' })
  newPassword: string;
}

export class SessionResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ example: 900, description: 'Validade do token de acesso, em segundos.' })
  expiresIn: number;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty()
  user: AuthenticatedUserDto;
}

export class AuthenticatedUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty({ enum: ['player', 'author', 'admin'] })
  role: string;

  @ApiPropertyOptional()
  locale?: string;
}

export class GoogleAuthorizationResponseDto {
  @ApiProperty()
  authorizationUrl: string;

  @ApiProperty()
  flowToken: string;

  @ApiProperty({ example: 600 })
  expiresInSeconds: number;
}
