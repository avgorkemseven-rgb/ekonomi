import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/config';
import { ImageProcessor } from './image-processor';
import { createStorageDriver, STORAGE_DRIVER } from './storage';

@Global()
@Module({
  providers: [
    ImageProcessor,
    { provide: STORAGE_DRIVER, inject: [APP_CONFIG], useFactory: (config: AppConfig) => createStorageDriver(config) },
  ],
  exports: [ImageProcessor, STORAGE_DRIVER],
})
export class MediaModule {}
