export class BlockResponseDto {
  id!: string;
  type!: string;
  content!: Record<string, any> | string | null;
  position!: number;
  document_id!: string;
  last_edited_by_id!: string | null;
  created_at!: Date;
  updated_at!: Date;
}
