export class VersionResponseDto {
  id!: string;
  version_number!: number;
  change_summary!: string | null;
  is_major!: boolean;
  created_by!: string | null;
  created_at!: Date;
  block_count!: number;
}
