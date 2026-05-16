import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  WorkspaceMember,
  WorkspaceRole,
} from './entities/workspace-member.entity';
import { Repository } from 'typeorm';

@Injectable()
export class WorkspaceMemberService {
  constructor(
    @InjectRepository(WorkspaceMember)
    private memberRepo: Repository<WorkspaceMember>,
  ) {}

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
}
