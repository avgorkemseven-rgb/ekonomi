import { Inject, Injectable } from '@nestjs/common';
import type { MeDto, PublicUserDto, UpdateProfileInput } from '@kleps/shared';
import { Errors } from '../common/errors';
import { APP_CONFIG, type AppConfig } from '../config/config';
import { PrismaService } from '../prisma/prisma.service';
import { toMeDto, toPublicUserDto } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async getMe(userId: string): Promise<MeDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw Errors.unauthorized();
    return toMeDto(user, this.config);
  }

  async updateMe(userId: string, input: UpdateProfileInput): Promise<MeDto> {
    const user = await this.prisma.user.update({ where: { id: userId }, data: input });
    return toMeDto(user, this.config);
  }

  async getPublicProfile(username: string): Promise<PublicUserDto> {
    const user = await this.prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (!user || user.status !== 'ACTIVE') throw Errors.notFound('User');
    const activeListingCount = await this.prisma.listing.count({
      where: { sellerId: user.id, status: 'ACTIVE', expiresAt: { gt: new Date() } },
    });
    return toPublicUserDto(user, activeListingCount);
  }
}
