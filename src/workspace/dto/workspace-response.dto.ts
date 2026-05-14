import { WorkspaceRole } from '../../workspace-member/entities/workspace-member.entity';

export class WorkspaceResponseDto {
  id!: string;
  name!: string;
  description!: string | null;
  owner_id!: string;
  created_at!: Date;
  updated_at!: Date;
  // Optional
  member_count?: number;
  my_role?: WorkspaceRole;
}
