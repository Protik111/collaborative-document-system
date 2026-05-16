import { IsEnum, IsNotEmpty } from 'class-validator';
import { WorkspaceRole } from '../../workspace-member/entities/workspace-member.entity';

export class UpdateRoleDto {
  @IsEnum(WorkspaceRole)
  @IsNotEmpty()
  role!: WorkspaceRole; // Only MEMBER, VIEWER allowed for invites (OWNER/ADMIN restricted)
}
