import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  WorkspaceMember,
  WorkspaceRole,
} from './entities/workspace-member.entity';
import { Repository } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { MemberResponseDto } from 'src/workspace/dto/member-response.dto';

@Injectable()
export class WorkspaceMemberService {
  constructor(
    @InjectRepository(WorkspaceMember)
    private memberRepo: Repository<WorkspaceMember>,
  ) {}

  /**
   * Add a user to a workspace with a specific role
   */
  async addMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMember> {
    // Check if already a member
    const existing = await this.memberRepo.findOne({
      where: { workspace_id: workspaceId, user_id: userId },
      withDeleted: true,
    });

    if (existing) {
      if (existing.deleted_at) {
        // Restore soft-deleted membership
        existing.deleted_at = null;
        existing.role = role;
        existing.updated_at = new Date();
        return this.memberRepo.save(existing);
      }
      throw new ConflictException('User is already a member of this workspace');
    }

    // Create new membership
    const membership = this.memberRepo.create({
      workspace_id: workspaceId,
      user_id: userId,
      role,
    });

    return this.memberRepo.save(membership);
  }

  /**
   * Get member info with user details (for response)
   */
  async getMemberWithUser(
    workspaceId: string,
    userId: string,
  ): Promise<
    (WorkspaceMember & { user: Pick<User, 'id' | 'email' | 'name'> }) | null
  > {
    return this.memberRepo
      .createQueryBuilder('member')
      .innerJoinAndSelect('member.user', 'user')
      .where('member.workspace_id = :workspaceId', { workspaceId })
      .andWhere('member.user_id = :userId', { userId })
      .select([
        'member.id',
        'member.role',
        'member.created_at',
        'user.id',
        'user.email',
        'user.name',
      ])
      .getOne() as Promise<any>;
  }
  /**
   * Update a member's role in a workspace (OWNER only)
   */
  async updateMemberRole(
    workspaceId: string,
    targetUserId: string,
    newRole: WorkspaceRole,
    actedByUserId: string,
  ): Promise<WorkspaceMember> {
    // Prevent demoting OWNER or changing OWNER role
    const membership = await this.memberRepo.findOne({
      where: { workspace_id: workspaceId, user_id: targetUserId },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    if (membership.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException('Cannot change role of the OWNER');
    }

    // Only OWNER can assign OWNER/ADMIN roles
    if ([WorkspaceRole.OWNER, WorkspaceRole.ADMIN].includes(newRole)) {
      const actorMembership = await this.memberRepo.findOne({
        where: { workspace_id: workspaceId, user_id: actedByUserId },
      });
      if (actorMembership?.role !== WorkspaceRole.OWNER) {
        throw new ForbiddenException('Only OWNER can assign elevated roles');
      }
    }

    membership.role = newRole;
    membership.updated_at = new Date();
    return this.memberRepo.save(membership);
  }

  /**
   * Remove member from workspace (soft delete)
   */
  async removeMember(
    workspaceId: string,
    targetUserId: string,
    actedByUserId: string,
  ): Promise<void> {
    // Can't remove OWNER
    if (targetUserId === actedByUserId) {
      // Self-leave: allowed
    }

    const membership = await this.memberRepo.findOne({
      where: { workspace_id: workspaceId, user_id: targetUserId },
    });

    if (!membership) {
      throw new NotFoundException('Member not found');
    }

    if (
      membership.role === WorkspaceRole.OWNER &&
      targetUserId !== actedByUserId
    ) {
      throw new ForbiddenException('Cannot remove OWNER from workspace');
    }

    // Soft delete
    await this.memberRepo.softDelete(membership.id);
  }

  /**
   * List all active members in a workspace (with user details)
   */
  async findAllByWorkspace(workspaceId: string): Promise<MemberResponseDto[]> {
    const members = await this.memberRepo
      .createQueryBuilder('member')
      .innerJoinAndSelect('member.user', 'user')
      .where('member.workspace_id = :workspaceId', { workspaceId })
      .andWhere('member.deleted_at IS NULL') // Only active members
      .select([
        'member.id',
        'member.role',
        'member.created_at',
        'user.id',
        'user.email',
        'user.name',
      ])
      .getMany();

    return members.map((m) => ({
      user_id: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      joined_at: m.created_at,
    }));
  }

  /**
   * Get single member details
   */
  async findOne(
    workspaceId: string,
    userId: string,
  ): Promise<MemberResponseDto | null> {
    const member = await this.memberRepo
      .createQueryBuilder('member')
      .innerJoinAndSelect('member.user', 'user')
      .where('member.workspace_id = :workspaceId', { workspaceId })
      .andWhere('member.user_id = :userId', { userId })
      .select([
        'member.id',
        'member.role',
        'member.created_at',
        'user.id',
        'user.email',
        'user.name',
      ])
      .getOne();

    if (!member) return null;

    return {
      user_id: member.user.id,
      email: member.user.email,
      name: member.user.name,
      role: member.role,
      joined_at: member.created_at,
    };
  }

  /**
   * Check if a user is a member of a workspace (at least VIEWER)
   */
  async hasMember(workspaceId: string, userId: string): Promise<boolean> {
    const membership = await this.memberRepo.findOne({
      where: { workspace_id: workspaceId, user_id: userId },
    });
    return !!membership;
  }
}
