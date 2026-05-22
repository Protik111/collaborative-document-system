import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { DocumentVersionService } from './document-version.service';
import { CreateVersionDto } from './dto/create-version.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth-guard';

@Controller('workspaces/:workspaceId/documents/:documentId/versions')
@UseGuards(JwtAuthGuard)
export class DocumentVersionController {
  constructor(private readonly versionService: DocumentVersionService) {}

  @Post()
  async create(
    @Param('documentId') docId: string,
    @Body() dto: CreateVersionDto,
    @Req() req: Request,
  ) {
    const user = req.user as { userId: string };
    return this.versionService.create(docId, user.userId, dto);
  }

  @Get()
  async findAll(@Param('documentId') docId: string, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.versionService.findAll(docId, user.userId);
  }

  @Post(':versionId/restore')
  async restore(
    @Param('documentId') docId: string,
    @Param('versionId') versionId: string,
    @Req() req: Request,
  ) {
    const user = req.user as { userId: string };
    return this.versionService.restore(docId, user.userId, parseInt(versionId));
  }
}
