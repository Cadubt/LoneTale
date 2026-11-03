import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PasswordModule } from '../auth/password.module';
import { ExternalLogin } from './entities/external-login.entity';
import { UserCredential } from './entities/user-credential.entity';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserCredential, ExternalLogin]), PasswordModule],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
