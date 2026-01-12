import {
  Controller,
  Delete,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
  Inject,
  HttpException,
  HttpStatus,
  Get,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { ImagesClient } from './images.provider';

@Controller('files')
export class FilesController {
  constructor(@Inject('IMAGES') private images: ImagesClient) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: any) {
    if (!file?.buffer) {
      throw new HttpException('Missing file', HttpStatus.BAD_REQUEST);
    }

    const mime = file.mimetype;
    const filename = file.originalname;

    const result = await this.images.upload(file.buffer, mime, filename);

    return {
      url: result.url, // ✅ igual que antes
      public_id: result.public_id,
    };
  }

  @Delete('delete/:publicId')
  async deleteFile(@Param('publicId') publicId: string) {
    try {
      return await this.images.delete(publicId);
    } catch (e: any) {
      throw new HttpException(
        e.message ?? 'Delete failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('list')
  async listFiles() {
    try {
      return await this.images.list();
    } catch (e: any) {
      throw new HttpException(
        'Failed to fetch images',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
