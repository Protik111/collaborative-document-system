import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Workspace } from './entities/workspace.entity';
import { Repository, In, IsNull } from 'typeorm';
import {
  WorkspaceMember,
  WorkspaceRole,
} from 'src/workspace-member/entities/workspace-member.entity';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { WorkspaceResponseDto } from './dto/workspace-response.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { MemberResponseDto } from './dto/member-response.dto';
import { UserService } from 'src/user/user.service';
import { WorkspaceMemberService } from 'src/workspace-member/workspace-member.service';

@Injectable()
export class WorkspaceService {
  constructor(
    @InjectRepository(Workspace)
    private workspaceRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private memberRepository: Repository<WorkspaceMember>,
    private readonly userService: UserService,
    private readonly workspaceMemberService: WorkspaceMemberService,
  ) {}

  /**
   * Create a new workspace + auto-add creator as OWNER
   */
  async create(
    createDto: CreateWorkspaceDto,
    userId: string,
  ): Promise<WorkspaceResponseDto> {
    const exisiting = await this.workspaceRepository.findOne({
      where: { name: createDto.name, owner_id: userId },
      withDeleted: true, //check for deleted workspaces with the same name
    });

    if (exisiting) {
      throw new ConflictException(
        'You already have a workspace with this name',
      );
    }

    const workspace = this.workspaceRepository.create({
      name: createDto.name,
      description: createDto.description,
      owner_id: userId,
    });
    const saved = await this.workspaceRepository.save(workspace);

    await this.memberRepository.save({
      workspace_id: saved.id,
      user_id: userId,
      role: WorkspaceRole.OWNER,
    });

    return this.toResponse(saved);
  }

  /**
   * List all workspaces the user belongs to
   */
  async findAllByUser(userId: string): Promise<WorkspaceResponseDto[]> {
    //get all workspaces Ids where useer is a member
    const memberships = await this.memberRepository.find({
      where: { user_id: userId },
      select: ['workspace_id'],
    });

    if (memberships.length === 0) {
      return [];
    }

    const workspaceIds = memberships.map((m) => m.workspace_id);

    const workspaces = await this.workspaceRepository.find({
      where: { id: In(workspaceIds), deleted_at: IsNull() },
      order: { created_at: 'DESC' },
    });
    return workspaces.map((w) => this.toResponse(w));
  }

  /**
   * Get workspace details by ID, only if user is a member
   */
  async findByIdForUser(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceResponseDto> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId, owner_id: userId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    //verify membership
    const membership = await this.memberRepository.findOne({
      where: { workspace_id: workspaceId, user_id: userId },
    });

    if (!membership) {
      throw new ForbiddenException(
        'Access denied. You are not a member of this workspace',
      );
    }

    return this.toResponse(workspace, membership.role);
  }

  /**
   * update workspace details, only if user is OWNER or ADMIN
   */
  async update(
    workspaceId: string,
    updateDto: UpdateWorkspaceDto,
    userId: string,
  ): Promise<WorkspaceResponseDto> {
    // 1. check authorization
    await this.requireRole(workspaceId, userId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
    ]);

    // 2. if name is being updated, check for duplicates
    if (updateDto?.name) {
      const existing = await this.workspaceRepository.findOne({
        where: { name: updateDto.name, owner_id: userId, id: workspaceId },
        withDeleted: true,
      });
      if (existing) {
        throw new ConflictException(
          'You already have a workspace with this name',
        );
      }
    }

    // 3. update workspace and return updated details
    await this.workspaceRepository.update(workspaceId, {
      name: updateDto.name,
      description: updateDto.description,
    });

    const updated = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (!updated) {
      throw new NotFoundException('Workspace not found after update');
    }

    return this.toResponse(updated);
  }

  /**
   * Soft delete a workspace, only if user is OWNER
   */
  async remove(workspaceId: string, userId: string): Promise<void> {
    await this.requireRole(workspaceId, userId, [WorkspaceRole.OWNER]);

    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      withDeleted: true,
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    await this.workspaceRepository.softDelete(workspaceId);
  }

  /**
   * Invite a user to join workspace by email
   */
  async inviteMember(
    workspaceId: string,
    inviterId: string,
    inviteDto: { email: string; role: WorkspaceRole },
  ): Promise<MemberResponseDto> {
    // 1. Verify inviter has permission (OWNER or ADMIN)
    await this.requireRole(workspaceId, inviterId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
    ]);

    // 2. Find user by email
    const user = await this.userService.findByEmailPublic(inviteDto.email);

    if (!user) {
      throw new NotFoundException('User with this email does not exist');
    }

    // 3. Prevent inviting OWNER role via invite (security)
    if ([WorkspaceRole.OWNER, WorkspaceRole.ADMIN].includes(inviteDto.role)) {
      // Only OWNER can assign elevated roles, and not via public invite
      const inviterMembership = await this.memberRepository.findOne({
        where: { workspace_id: workspaceId, user_id: inviterId },
      });
      if (inviterMembership?.role !== WorkspaceRole.OWNER) {
        throw new ForbiddenException('Only OWNER can assign elevated roles');
      }
    }

    // 4. Add member via WorkspaceMemberService
    const membership = await this.workspaceMemberService.addMember(
      workspaceId,
      user.id,
      inviteDto.role,
    );

    // 5. Return safe response
    return {
      user_id: user.id,
      email: user.email,
      name: user.name,
      role: membership.role,
      joined_at: membership.created_at,
    };
  }

  /**
   * Helper to check if user has one of the required roles in the workspace
   */
  private async requireRole(
    workspaceId: string,
    userId: string,
    roles: WorkspaceRole[],
  ): Promise<void> {
    const membership = await this.memberRepository.findOne({
      where: { workspace_id: workspaceId, user_id: userId },
    });

    if (!membership || !roles.includes(membership.role)) {
      throw new ForbiddenException('Access denied. Insufficient permissions');
    }
  }

  /**
   * Mapper: Entity → Response DTO
   */
  private toResponse(
    workspace: Workspace,
    userRole?: WorkspaceRole,
  ): WorkspaceResponseDto {
    return {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      owner_id: workspace.owner_id,
      created_at: workspace.created_at,
      updated_at: workspace.updated_at,
      ...(userRole && { my_role: userRole }),
    };
  }
}
