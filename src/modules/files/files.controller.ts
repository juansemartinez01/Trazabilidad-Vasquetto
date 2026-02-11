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
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { ImagesClient } from './images.provider';

@Controller('files')
export class FilesController {
  constructor(@Inject('IMAGES') private images: ImagesClient) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@Req() req: any, @UploadedFile() file: any) {
    if (!file?.buffer) {
      throw new HttpException('Missing file', HttpStatus.BAD_REQUEST);
    }

    const s3TenantKey = req.s3TenantKey;
    if (!s3TenantKey) {
      throw new HttpException('Missing s3TenantKey', HttpStatus.UNAUTHORIZED);
    }

    const result = await this.images.upload(
      s3TenantKey,
      file.buffer,
      file.mimetype,
      file.originalname,
    );

    return { url: result.url, public_id: result.public_id };
  }

  @Delete('delete/:publicId')
  async deleteFile(@Req() req: any, @Param('publicId') publicId: string) {
    const s3TenantKey = req.s3TenantKey;
    if (!s3TenantKey) {
      throw new HttpException('Missing s3TenantKey', HttpStatus.UNAUTHORIZED);
    }

    try {
      return await this.images.delete(s3TenantKey, publicId);
    } catch (e: any) {
      throw new HttpException(
        e.message ?? 'Delete failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('list')
  async listFiles(@Req() req: any) {
    const s3TenantKey = req.s3TenantKey;
    if (!s3TenantKey) {
      throw new HttpException('Missing s3TenantKey', HttpStatus.UNAUTHORIZED);
    }

    try {
      return await this.images.list(s3TenantKey);
    } catch {
      throw new HttpException(
        'Failed to fetch images',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
