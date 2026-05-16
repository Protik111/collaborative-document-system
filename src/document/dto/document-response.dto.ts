export class DocumentResponseDto {
  id!: string;
  title!: string;
  content_preview!: string | null;
  workspace_id!: string;
  created_by!: string | null;
  created_at!: Date;
  updated_at!: Date;
}
