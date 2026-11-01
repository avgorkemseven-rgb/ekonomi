import { Module } from '@nestjs/common';
import { ListingImagesService } from './listing-images.service';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Module({
  controllers: [ListingsController],
  providers: [ListingsService, ListingImagesService],
  exports: [ListingsService, ListingImagesService],
})
export class ListingsModule {}
