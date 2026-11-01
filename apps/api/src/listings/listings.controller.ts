import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  ERROR_CODES,
  imageOrderSchema,
  listingCloseSchema,
  listingCreateSchema,
  listingUpdateSchema,
  myListingsQuerySchema,
  parseListingSearchQuery,
  type ImageOrderInput,
  type ListingCloseInput,
  type ListingCreateInput,
  type ListingUpdateInput,
  type MyListingsQuery,
} from '@kleps/shared';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { JwtAuthGuard, OptionalAuthGuard } from '../auth/guards';
import { Errors } from '../common/errors';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PHOTO_MAX_BYTES_CEILING } from '../config/config';
import { ListingImagesService } from './listing-images.service';
import { ListingsService } from './listings.service';

// Hard upper bound for multer (matches the config maximum); PHOTO_MAX_BYTES is enforced in the service.
const MULTER_HARD_LIMIT = PHOTO_MAX_BYTES_CEILING;

function parseSearch(raw: Record<string, unknown>) {
  const parsed = parseListingSearchQuery(raw);
  if (!parsed.success) {
    throw Errors.badRequest(
      ERROR_CODES.VALIDATION_ERROR,
      'Invalid search query',
      parsed.error.issues.map((i) => ({ path: i.path.filter((p) => typeof p !== 'symbol'), message: i.message })),
    );
  }
  return parsed.data;
}

@Controller()
export class ListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly images: ListingImagesService,
  ) {}

  @Get('listings')
  search(@Query() query: Record<string, unknown>) {
    return this.listings.search(parseSearch(query));
  }

  @Get('users/:username/listings')
  sellerListings(@Param('username') username: string, @Query() query: Record<string, unknown>) {
    return this.listings.search({ ...parseSearch(query), seller: username });
  }

  @Get('listings/:id')
  @UseGuards(OptionalAuthGuard)
  detail(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.listings.getById(id, user);
  }

  @Get('me/listings')
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: AuthUser, @Query(new ZodValidationPipe(myListingsQuerySchema)) query: MyListingsQuery) {
    return this.listings.myListings(user, query);
  }

  @Post('listings')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  create(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(listingCreateSchema)) body: ListingCreateInput) {
    return this.listings.create(user, body);
  }

  @Patch('listings/:id')
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(listingUpdateSchema)) body: ListingUpdateInput,
  ) {
    return this.listings.update(user, id, body);
  }

  @Delete('listings/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    const { imageKeys } = await this.listings.remove(user, id);
    await this.images.deleteObjects(imageKeys);
  }

  @Post('listings/:id/publish')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  publish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.listings.publish(user, id);
  }

  @Post('listings/:id/renew')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  renew(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.listings.renew(user, id);
  }

  @Post('listings/:id/close')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  close(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(listingCloseSchema)) body: ListingCloseInput,
  ) {
    return this.listings.close(user, id, body);
  }

  @Post('listings/:id/images')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MULTER_HARD_LIMIT, files: 1, fields: 5 } }))
  upload(@CurrentUser() user: AuthUser, @Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    return this.images.upload(user, id, file);
  }

  @Delete('listings/:id/images/:imageId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async removeImage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('imageId') imageId: string) {
    await this.images.remove(user, id, imageId);
  }

  @Put('listings/:id/images/order')
  @UseGuards(JwtAuthGuard)
  reorder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(imageOrderSchema)) body: ImageOrderInput,
  ) {
    return this.images.reorder(user, id, body);
  }
}
