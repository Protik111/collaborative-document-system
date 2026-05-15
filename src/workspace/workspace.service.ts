import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Workspace } from './entities/workspace.entity';
import { Repository, In, IsNull } from 'typeorm';
import {
  WorkspaceMember,
  WorkspaceRole,
} from 'src/workspace-member/entities/workspace-member.entity';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { WorkspaceResponseDto } from './dto/workspace-response.dto';

@Injectable()
export class WorkspaceService {
  constructor(
    @InjectRepository(Workspace)
    private workspaceRepository: Repository<Workspace>,
    @InjectRepository(Workspace)
    private memberRepository: Repository<WorkspaceMember>,
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
