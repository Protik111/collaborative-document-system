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

@Controller('workspace')
@UseGuards(JwtAuthGuard) // Ensure all routes require authentication
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

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
}
