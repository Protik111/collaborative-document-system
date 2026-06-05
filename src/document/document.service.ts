import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { Repository, DataSource } from 'typeorm';
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
    private readonly dataSource: DataSource, //Inject for transactions + locking
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
   * Full-Text search
   */
    async search(
    workspaceId: string,
    userId: string,
    query: string,
  ): Promise<DocumentResponseDto[]> {
    await this.verifymembership(workspaceId, userId);

    // Fallback to normal list if query is too short
    if (!query || query.trim().length < 2) {
      const result = await this.findAll(workspaceId, userId);
      return result.data;
    }

    // Use QueryBuilder for advanced PostgreSQL tsvector search + ranking
    const docs = await this.documentRepo
      .createQueryBuilder('doc')
      .where('doc.workspace_id = :workspaceId', { workspaceId })
      .andWhere('doc.deleted_at IS NULL')
      .andWhere(
        `to_tsvector('english', coalesce(doc.title, '') || ' ' || coalesce(doc.content_preview, '')) @@ plainto_tsquery('english', :query)`,
        { query },
      )
      .orderBy(
        `ts_rank(to_tsvector('english', coalesce(doc.title, '') || ' ' || coalesce(doc.content_preview, '')), plainto_tsquery('english', :query))`,
        'DESC',
      )
      .getMany();

    return docs.map((doc) => this.toResponse(doc));
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
     return this.dataSource.transaction(async (manager) => {
      // 1. Lock the row: No other transaction can read/write this row until we commit
      const doc = await manager.findOne(Document, {
        where: { id: documentId },
        lock: { mode: 'pessimistic_write' }, // Equivalent to SELECT ... FOR UPDATE
      });

      if (!doc) {
        throw new NotFoundException('Document not found');
      }

      // 2. Verify access (still needed, as lock doesn't check business logic)
      await this.verifymembership(doc.workspace_id, userId);

      // 3. Apply updates
      doc.title = dto.title ?? doc.title;
      doc.content_preview = dto.content_preview ?? doc.content_preview;

      // 4. Save (PostgreSQL automatically updates the generated search_vector column!)
      const updated = await manager.save(Document, doc);
      return this.toResponse(updated);
    });
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

  /**
   * Find one document by ID (with access check)
   */
  async findOne(
    documentId: string,
    userId: string,
  ): Promise<DocumentResponseDto> {
    const doc = await this.documentRepo.findOne({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Document not found');

    await this.verifymembership(doc.workspace_id, userId);

    return this.toResponse(doc);
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
