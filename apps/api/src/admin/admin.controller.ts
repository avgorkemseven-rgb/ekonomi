import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  adminListingsQuerySchema,
  adminUsersQuerySchema,
  attributeCreateSchema,
  attributeUpdateSchema,
  auditQuerySchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  moderationReasonSchema,
  userStatusSchema,
  type AdminListingsQuery,
  type AdminUsersQuery,
  type AttributeCreateInput,
  type AttributeUpdateInput,
  type AuditQuery,
  type CategoryCreateInput,
  type CategoryUpdateInput,
  type ModerationReason,
  type UserStatusInput,
} from '@kleps/shared';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AdminService } from './admin.service';

/** Moderator-level endpoints (listing moderation, stats, audit). Category and user management require ADMIN. */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MODERATOR')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @Get('listings')
  listings(@Query(new ZodValidationPipe(adminListingsQuerySchema)) query: AdminListingsQuery) {
    return this.admin.listings(query);
  }

  @Post('listings/:id/approve')
  @HttpCode(200)
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Req() req: Request) {
    return this.admin.approve(user, id, req.ip);
  }

  @Post('listings/:id/reject')
  @HttpCode(200)
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moderationReasonSchema)) body: ModerationReason,
    @Req() req: Request,
  ) {
    return this.admin.reject(user, id, body.reason, req.ip);
  }

  @Post('listings/:id/remove')
  @HttpCode(200)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moderationReasonSchema)) body: ModerationReason,
    @Req() req: Request,
  ) {
    return this.admin.removeListing(user, id, body.reason, req.ip);
  }

  @Get('audit-logs')
  audit(@Query(new ZodValidationPipe(auditQuerySchema)) query: AuditQuery) {
    return this.admin.auditLogs(query.page, query.pageSize, query.entityId);
  }

  @Get('categories')
  categories() {
    return this.admin.allCategories();
  }

  @Post('categories')
  @Roles('ADMIN')
  createCategory(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(categoryCreateSchema)) body: CategoryCreateInput,
    @Req() req: Request,
  ) {
    return this.admin.createCategory(user, body, req.ip);
  }

  @Patch('categories/:id')
  @Roles('ADMIN')
  updateCategory(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(categoryUpdateSchema)) body: CategoryUpdateInput,
    @Req() req: Request,
  ) {
    return this.admin.updateCategory(user, id, body, req.ip);
  }

  @Post('categories/:id/attributes')
  @Roles('ADMIN')
  createAttribute(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(attributeCreateSchema)) body: AttributeCreateInput,
    @Req() req: Request,
  ) {
    return this.admin.createAttribute(user, id, body, req.ip);
  }

  @Patch('attributes/:id')
  @Roles('ADMIN')
  updateAttribute(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(attributeUpdateSchema)) body: AttributeUpdateInput,
    @Req() req: Request,
  ) {
    return this.admin.updateAttribute(user, id, body, req.ip);
  }

  @Delete('attributes/:id')
  @Roles('ADMIN')
  @HttpCode(204)
  async deleteAttribute(@CurrentUser() user: AuthUser, @Param('id') id: string, @Req() req: Request): Promise<void> {
    await this.admin.deleteAttribute(user, id, req.ip);
  }

  @Get('users')
  @Roles('ADMIN')
  users(@Query(new ZodValidationPipe(adminUsersQuerySchema)) query: AdminUsersQuery) {
    return this.admin.users(query);
  }

  @Post('users/:id/status')
  @Roles('ADMIN')
  @HttpCode(200)
  setUserStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(userStatusSchema)) body: UserStatusInput,
    @Req() req: Request,
  ) {
    return this.admin.setUserStatus(user, id, body.status, body.reason, req.ip);
  }
}
