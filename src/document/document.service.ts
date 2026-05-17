import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { Repository } from 'typeorm';
import { WorkspaceMemberService } from 'src/workspace-member/workspace-member.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentResponseDto } from './dto/document-response.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(Document)
    private documentRepo: Repository<Document>,
    private workspaceMemberService: WorkspaceMemberService,
  ) {}

  /**
   * Verify user is at least a VIEWER in the workspace
   */
  private async verifymembership(workspaceId: string, userId: string) {
    const memebership = await this.workspaceMemberService.hasMember(
      workspaceId,
      userId,
    );
    if (!memebership) {
      throw new ForbiddenException('You do not have access to this workspace');
    }
  }

  /**
   * create a new document in a workspace
   */
  async createDocument(
    workspaceId: string,
    userId: string,
    dto: CreateDocumentDto,
  ): Promise<DocumentResponseDto> {
    await this.verifymembership(workspaceId, userId);
    const document = this.documentRepo.create({
      workspace_id: workspaceId,
      created_by: userId,
      title: dto.title,
      content_preview: dto.content_preview ?? null,
    });
    const saved = await this.documentRepo.save(document);
    return this.toResponse(saved);
  }

  /**
   * find all documents in a workspace (with pagination)
   */
  async findAll(
    workspaceId: string,
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: DocumentResponseDto[]; total: number }> {
    await this.verifymembership(workspaceId, userId);
    const [documents, total] = await this.documentRepo.findAndCount({
      where: { workspace_id: workspaceId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: documents.map((doc) => this.toResponse(doc)),
      total,
    };
  }

  /**
   * update a document's title and content preview
   */
  async updateDocument(
    documentId: string,
    userId: string,
    dto: UpdateDocumentDto,
  ): Promise<DocumentResponseDto> {
    const doc = await this.documentRepo.findOne({
      where: { id: documentId },
    });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    await this.verifymembership(doc.workspace_id, userId);

    await this.documentRepo.update(documentId, {
      title: dto.title,
      content_preview: dto.content_preview ?? null,
    });

    const updated = await this.documentRepo.findOne({
      where: { id: documentId },
    });
    return this.toResponse(updated!);
  }

  /**
   * Remove a document (soft delete)
   */
  async remove(documentId: string, userId: string): Promise<void> {
    const doc = await this.documentRepo.findOne({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Document not found');

    await this.verifymembership(doc.workspace_id, userId);

    await this.documentRepo.softDelete(documentId);
  }

  private toResponse(document: DocumentResponseDto): DocumentResponseDto {
    return {
      id: document.id,
      title: document.title,
      content_preview: document.content_preview,
      workspace_id: document.workspace_id,
      created_by: document.created_by,
      created_at: document.created_at,
      updated_at: document.updated_at,
    };
  }
}
