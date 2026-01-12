import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FilesController } from './files.controller';
import { ImagesProvider } from './images.provider';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(), // 👈 necesario para tener file.buffer
      limits: { fileSize: 15 * 1024 * 1024 }, // igual a tu MAX_UPLOAD_BYTES
    }),
  ],
  controllers: [FilesController],
  providers: [ImagesProvider],
  exports: [ImagesProvider],
})
export class FilesModule {}
