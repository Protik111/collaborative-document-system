import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateVersionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  change_summary?: string;

  @IsOptional()
  @IsBoolean()
  is_major?: boolean;
}
