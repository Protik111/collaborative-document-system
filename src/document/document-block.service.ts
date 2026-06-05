import { InjectRepository } from '@nestjs/typeorm';
import { DocumentBlock } from './entities/document-block.entity';
import { Between, Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { WorkspaceMemberService } from 'src/workspace-member/workspace-member.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateBlockDto } from './dto/create-block.dto';
import { BlockResponseDto } from './dto/block-response.dto';
import { UpdateBlockDto } from './dto/update-block.dto';

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
    await this.syncContentPreview(documentId);
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

  /**
   * Update a document block's content, type, or position
   * @param blockId
   * @param document_id
   * @param userId
   * @param dto
   * @returns
   */
  async update(
    blockId: string,
    document_id: string,
    userId: string,
    dto: UpdateBlockDto,
  ): Promise<BlockResponseDto> {
    await this.requireAccess(document_id, userId);

    const block = await this.blockRepo.findOne({
      where: { id: blockId, document_id: document_id },
    });
    if (!block) {
      throw new NotFoundException('Block not found');
    }

    // Handle position shift if changed
    if (dto.position !== undefined && dto.position !== block.position) {
      await this.shiftPositions(document_id, block.position, dto.position);
    }

    await this.blockRepo.update(blockId, {
      type: dto.type,
      content: dto.content,
      position: dto.position ?? block.position,
      last_edited_by_id: userId,
    });

    await this.syncContentPreview(document_id);

    const updated = await this.blockRepo.findOne({ where: { id: blockId } });
    return this.toResponse(updated!);
  }

  /**
   * Soft delete a block (mark as deleted without removing from DB)
   */
  async remove(blockId: string, docId: string, userId: string): Promise<void> {
    await this.requireAccess(docId, userId);

    const block = await this.blockRepo.findOne({
      where: { id: blockId, document_id: docId },
    });
    if (!block) throw new NotFoundException('Block not found');

    await this.blockRepo.softDelete(blockId);
    await this.syncContentPreview(docId);
  }

  /**
   * Regenerate document content preview based on its blocks
   */
  private async syncContentPreview(documentId: string) {
    const blocks = await this.blockRepo.find({
      where: { document_id: documentId },
      order: { position: 'ASC' },
      take: 10,
    });

    let preview = '';
    for (const block of blocks) {
      let text = '';
      if (typeof block.content === 'string') {
        text = block.content;
      } else if (block.content && typeof block.content === 'object') {
        // Handle Quill/other editors JSON structure if needed, 
        // fallback to common 'text' property or just stringify
        text = (block.content as any).text || (block.content as any).content || '';
        if (!text && typeof block.content === 'object') {
          // If it's a rich text object we don't recognize, we might need a better extractor
          // but for now let's assume it's simple
        }
      }

      if (text) {
        preview += (preview ? ' ' : '') + text;
      }

      if (preview.length > 500) break;
    }

    const finalPreview = preview.substring(0, 500);
    await this.docRepo.update(documentId, { content_preview: finalPreview });
  }

  /**
   * Shift positions when a block is moved
   */
  private async shiftPositions(
    docId: string,
    oldPos: number,
    newPos: number,
  ): Promise<void> {
    if (oldPos < newPos) {
      // Moving down: shift blocks between old+1 and newPos up by -1
      await this.blockRepo.update(
        { document_id: docId, position: Between(oldPos + 1, newPos) },
        { position: () => '"position" - 1' },
      );
    } else {
      // Moving up: shift blocks between newPos and old-1 down by +1
      await this.blockRepo.update(
        { document_id: docId, position: Between(newPos, oldPos - 1) },
        { position: () => '"position" + 1' },
      );
    }
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
