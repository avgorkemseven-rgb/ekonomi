import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { updateProfileSchema, type UpdateProfileInput } from '@kleps/shared';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/guards';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput) {
    return this.users.updateMe(user.id, body);
  }

  @Get('users/:username')
  profile(@Param('username') username: string) {
    return this.users.getPublicProfile(username);
  }
}
