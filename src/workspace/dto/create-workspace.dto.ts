import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}
