import { InjectRepository } from '@nestjs/typeorm';
import { DocumentBlock } from './entities/document-block.entity';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { WorkspaceMemberService } from 'src/workspace-member/workspace-member.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateBlockDto } from './dto/create-block.dto';
import { BlockResponseDto } from './dto/block-response.dto';

export class DocumentBlockService {
  constructor(
    @InjectRepository(DocumentBlock)
    private blockRepo: Repository<DocumentBlock>,
    @InjectRepository(Document)
    private docRepo: Repository<Document>,
    private readonly memberService: WorkspaceMemberService,
  ) {}

  /**
   * Verify user is a member of the document's workspace
   */
  private async requireAccess(documentId: string, userId: string) {
    const doc = await this.docRepo.findOne({
      where: { id: documentId },
    });
    if (!doc || doc.deleted_at)
      throw new NotFoundException('Document not found');

    const isMember = await this.memberService.hasMember(
      doc.workspace_id,
      userId,
    );
    if (!isMember) {
      throw new ForbiddenException('Access denied to this document');
    }
    return doc;
  }

  /**
   * Creates a new document block
   * @param documentId
   * @param userId
   * @param dto
   * @returns
   */
  async create(
    documentId: string,
    userId: string,
    dto: CreateBlockDto,
  ): Promise<BlockResponseDto> {
    await this.requireAccess(documentId, userId);

    let position = dto.position;
    if (position === undefined) {
      const maxPos = await this.blockRepo
        .createQueryBuilder('b')
        .select('MAX(b.position)', 'max')
        .where('b.document_id = :documentId', { documentId })
        .getRawOne();
      position = (maxPos?.max ?? -1) + 1;
    }

    const block = this.blockRepo.create({
      document_id: documentId,
      type: dto.type,
      content: dto.content ?? null,
      position,
      last_edited_by_id: userId,
    });
    const saved = await this.blockRepo.save(block);
    return this.toResponse(saved);
  }

  /**
   * find all document blocks for a document, ordered by position
   * @param documentId
   * @param userId
   * @returns
   */
  async findAll(
    documentId: string,
    userId: string,
  ): Promise<BlockResponseDto[]> {
    await this.requireAccess(documentId, userId);

    const blocks = await this.blockRepo.find({
      where: { document_id: documentId },
      order: { position: 'ASC' },
    });

    return blocks.map((b) => this.toResponse(b));
  }

  private toResponse(block: DocumentBlock): BlockResponseDto {
    return {
      id: block.id,
      type: block.type,
      content: block.content,
      position: block.position,
      document_id: block.document_id,
      last_edited_by_id: block.last_edited_by_id,
      created_at: block.created_at,
      updated_at: block.updated_at,
    };
  }
}
