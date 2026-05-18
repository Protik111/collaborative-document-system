import { InjectRepository } from '@nestjs/typeorm';
import { DocumentBlock } from './entities/document-block.entity';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { WorkspaceMemberService } from 'src/workspace-member/workspace-member.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

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
}
