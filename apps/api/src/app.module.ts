import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.service';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { CategoriesModule } from './categories/categories.module';
import { AllExceptionsFilter } from './common/http-exception.filter';
import type { AppConfig } from './config/config';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.controller';
import { ListingsModule } from './listings/listings.module';
import { MediaModule } from './media/media.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(config),
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
          skipIf: () => !config.RATE_LIMIT_ENABLED,
        }),
        PrismaModule,
        AuditModule,
        MediaModule,
        CategoriesModule,
        AuthModule,
        UsersModule,
        CatalogModule,
        ListingsModule,
        AdminModule,
        HealthModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
    };
  }
}
