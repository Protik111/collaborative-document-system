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
} from '@nestjs/common';
import { Request } from 'express';
import { DocumentBlockService } from './document-block.service';
import { CreateBlockDto } from './dto/create-block.dto';
import { UpdateBlockDto } from './dto/update-block.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth-guard';

@Controller('workspaces/:workspaceId/documents/:documentId/blocks')
@UseGuards(JwtAuthGuard)
export class DocumentBlockController {
  constructor(private readonly blockService: DocumentBlockService) {}

  @Post()
  async create(
    @Param('documentId') docId: string,
    @Body() dto: CreateBlockDto,
    @Req() req: Request,
  ) {
    const user = req.user as { userId: string };
    return this.blockService.create(docId, user.userId, dto);
  }

  @Get()
  async findAll(@Param('documentId') docId: string, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.blockService.findAll(docId, user.userId);
  }

  @Patch(':blockId')
  async update(
    @Param('documentId') docId: string,
    @Param('blockId') blockId: string,
    @Body() dto: UpdateBlockDto,
    @Req() req: Request,
  ) {
    const user = req.user as { userId: string };
    return this.blockService.update(blockId, docId, user.userId, dto);
  }

  @Delete(':blockId')
  async remove(
    @Param('documentId') docId: string,
    @Param('blockId') blockId: string,
    @Req() req: Request,
  ) {
    const user = req.user as { userId: string };
    await this.blockService.remove(blockId, docId, user.userId);
    return { message: 'Block deleted successfully' };
  }
}
