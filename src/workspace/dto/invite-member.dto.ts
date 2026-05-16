import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { WorkspaceRole } from '../../workspace-member/entities/workspace-member.entity';

export class InviteMemberDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsEnum(WorkspaceRole)
  @IsNotEmpty()
  role!: WorkspaceRole; // Only MEMBER, VIEWER allowed for invites (OWNER/ADMIN restricted)
}
