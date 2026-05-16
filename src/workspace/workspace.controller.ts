import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { Request } from 'express';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth-guard';
import { InviteMemberDto } from './dto/invite-member.dto';
import { MemberResponseDto } from './dto/member-response.dto';
import { WorkspaceMemberService } from 'src/workspace-member/workspace-member.service';
import { WorkspaceRole } from 'src/workspace-member/entities/workspace-member.entity';

@Controller('workspace')
@UseGuards(JwtAuthGuard) // Ensure all routes require authentication
export class WorkspaceController {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly workspaceMemberService: WorkspaceMemberService,
  ) {}

  @Post()
  async createWorkspace(
    @Body() createDto: CreateWorkspaceDto,
    @Req() req: Request,
  ) {
    const user = req.user as { userId: string };
    return this.workspaceService.create(createDto, user.userId);
  }

  @Get()
  async findAll(@Req() req: Request) {
    const user = req.user as { userId: string };
    return this.workspaceService.findAllByUser(user.userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.workspaceService.findByIdForUser(id, user.userId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateWorkspaceDto,
    @Req() req: Request,
  ) {
    const user = req.user as { userId: string };
    return this.workspaceService.update(id, updateDto, user.userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.workspaceService.remove(id, user.userId);
  }

  //membership management endpoints starts
  @Post(':id/invite')
  async inviteMember(
    @Param('id') workspaceId: string,
    @Body() inviteDto: InviteMemberDto,
    @Req() req: Request,
  ): Promise<MemberResponseDto> {
    const user = req.user as { userId: string };
    return this.workspaceService.inviteMember(
      workspaceId,
      user.userId,
      inviteDto,
    );
  }

  @Get(':id/members')
  async getMembers(
    @Param('id') workspaceId: string,
    @Req() req: Request,
  ): Promise<MemberResponseDto[]> {
    const user = req.user as { userId: string };
    // Verify requester is a member of the workspace
    await this.workspaceService.findByIdForUser(workspaceId, user.userId);

    return this.workspaceMemberService.findAllByWorkspace(workspaceId);
  }

  @Get(':id/members/:userId')
  async getMember(
    @Param('id') workspaceId: string,
    @Param('userId') userId: string,
    @Req() req: Request,
  ): Promise<MemberResponseDto | null> {
    const user = req.user as { userId: string };
    // Verify requester is a member of the workspace
    await this.workspaceService.findByIdForUser(workspaceId, user.userId);

    return this.workspaceMemberService.findOne(workspaceId, userId);
  }

  @Patch(':id/members/:userId')
  async updateMemberRole(
    @Param('id') workspaceId: string,
    @Param('userId') userId: string,
    @Body() updateDto: { role: WorkspaceRole },
    @Req() req: Request,
  ): Promise<MemberResponseDto> {
    const user = req.user as { userId: string };
    // Verify requester is a member of the workspace
    await this.workspaceService.findByIdForUser(workspaceId, user.userId);
    return this.workspaceMemberService.updateMemberRole(
      workspaceId,
      userId,
      updateDto.role,
      user.userId,
    );
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @Param('id') workspaceId: string,
    @Param('userId') targetUserId: string,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const user = req.user as { userId: string };

    // Allow self-leave, otherwise require OWNER/ADMIN
    if (user.userId !== targetUserId) {
      const member = await this.workspaceMemberService.findOne(
        workspaceId,
        user.userId,
      );
      if (
        !member ||
        ![WorkspaceRole.OWNER, WorkspaceRole.ADMIN].includes(member.role)
      ) {
        throw new Error('Insufficient permissions');
      }
    }

    await this.workspaceMemberService.removeMember(
      workspaceId,
      targetUserId,
      user.userId,
    );
    return { message: 'Member removed successfully' };
  }

  // membership management endpoints ends
}
