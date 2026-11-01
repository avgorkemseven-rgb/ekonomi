import { Global, Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthResolver, JwtAuthGuard, OptionalAuthGuard, RolesGuard } from './guards';
import { TokenService } from './token.service';

@Global()
@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, TokenService, AuthResolver, JwtAuthGuard, OptionalAuthGuard, RolesGuard],
  exports: [AuthService, TokenService, AuthResolver, JwtAuthGuard, OptionalAuthGuard, RolesGuard],
})
export class AuthModule {}
