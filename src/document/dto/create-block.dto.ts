import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { BlockType } from '../entities/document-block.entity';

export class CreateBlockDto {
  @IsEnum(BlockType)
  type!: BlockType;

  @IsOptional()
  content?: Record<string, any> | string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
