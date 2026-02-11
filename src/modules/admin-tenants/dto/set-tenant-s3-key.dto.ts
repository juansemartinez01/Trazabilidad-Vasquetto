import { IsString, MaxLength } from 'class-validator';

export class SetTenantS3KeyDto {
  @IsString()
  @MaxLength(100)
  s3TenantKey: string;
}
