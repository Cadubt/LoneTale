import { Module } from '@nestjs/common';

import { PasswordService } from './password.service';

/**
 * Modulo minimo para a derivacao de senhas.
 *
 * Existe separado de `AuthModule` para que `UsersModule` possa usar o servico
 * sem criar uma dependencia circular entre os dois modulos.
 */
@Module({
  providers: [PasswordService],
  exports: [PasswordService],
})
export class PasswordModule {}
