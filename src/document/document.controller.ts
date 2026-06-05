import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { Request } from 'express';
import { DocumentService } from './document.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth-guard';

@Controller('workspaces/:workspaceId/documents')
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(private readonly docService: DocumentService) {}

  @Post()
  async create(
    @Param('workspaceId') wsId: string,
    @Body() dto: CreateDocumentDto,
    @Req() req: Request,
  ) {
    const user = req.user as { userId: string };
    return this.docService.createDocument(wsId, user.userId, dto);
  }

  @Get('search')
  async search(
    @Param('workspaceId') wsId: string,
    @Query('q') query: string,
    @Req() req: Request,
  ) {
    const user = req.user as { userId: string };
    return this.docService.search(wsId, user.userId, query);
  }

  @Post('sync-previews')
  async syncPreviews() {
    return this.docService.syncAllPreviews();
  }

  @Get()
  async findAll(@Param('workspaceId') wsId: string, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.docService.findAll(wsId, user.userId);
  }

  @Get(':docId')
  async findOne(
    @Param('workspaceId') _wsId: string,
    @Param('docId') docId: string,
    @Req() req: Request,
  ) {
    const user = req.user as { userId: string };
    return this.docService.findOne(docId, user.userId);
  }

  @Patch(':docId')
  async update(
    @Param('workspaceId') _wsId: string,
    @Param('docId') docId: string,
    @Body() dto: UpdateDocumentDto,
    @Req() req: Request,
  ) {
    const user = req.user as { userId: string };
    return this.docService.updateDocument(docId, user.userId, dto);
  }

  @Delete(':docId')
  async remove(
    @Param('workspaceId') _wsId: string,
    @Param('docId') docId: string,
    @Req() req: Request,
  ) {
    const user = req.user as { userId: string };
    await this.docService.remove(docId, user.userId);
    return { message: 'Document deleted successfully' };
  }
}
