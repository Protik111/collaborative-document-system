import { WorkspaceRole } from '../../workspace-member/entities/workspace-member.entity';

export class MemberResponseDto {
  user_id!: string;
  email!: string;
  name!: string;
  role!: WorkspaceRole;
  joined_at!: Date;
}
