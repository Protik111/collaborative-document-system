import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan } from 'typeorm';
import { DocumentVersion } from './entities/document-version.entity';
import { DocumentBlock } from './entities/document-block.entity';
import { Document } from './entities/document.entity';
import { WorkspaceMemberService } from '../workspace-member/workspace-member.service';
import { CreateVersionDto } from './dto/create-version.dto';
import { VersionResponseDto } from './dto/version-response.dto';

@Injectable()
export class DocumentVersionService {
  constructor(
    @InjectRepository(DocumentVersion)
    private versionRepo: Repository<DocumentVersion>,
    @InjectRepository(DocumentBlock)
    private blockRepo: Repository<DocumentBlock>,
    @InjectRepository(Document)
    private docRepo: Repository<Document>,
    private readonly memberService: WorkspaceMemberService,
    private readonly dataSource: DataSource, // For transactions
  ) {}

  private async requireAccess(docId: string, userId: string) {
    const doc = await this.docRepo.findOne({ where: { id: docId } });

    const isMember = await this.memberService.hasMember(
      doc!.workspace_id,
      userId,
    );

    if (!doc || doc.deleted_at)
      throw new NotFoundException('Document not found');
    if (!isMember) throw new ForbiddenException('Access denied');
    return doc;
  }

  /**
   * Create a new version snapshot
   */
  async create(
    docId: string,
    userId: string,
    dto: CreateVersionDto,
  ): Promise<VersionResponseDto> {
    const doc = await this.requireAccess(docId, userId);

    //get current block in order
    const blocks = await this.blockRepo.find({
      where: { document_id: docId },
      order: { position: 'ASC' },
    });

    //serialize blocks for JSON storage (stripe relationship)
    const blocks_snapshot = blocks.map((b) => ({
      id: b.id,
      type: b.type,
      content: b.content,
      position: b.position,
    }));

    //calculate next version number
    const maxVersion = await this.versionRepo
      .createQueryBuilder('v')
      .select('MAX(v.version_number)', 'max')
      .where('v.document_id = :docId', { docId })
      .getRawOne();

    const nextVersion = (maxVersion.max ?? 0) + 1;

    //create new version
    const version = this.versionRepo.create({
      document_id: docId,
      version_number: nextVersion,
      blocks_snapshot: blocks_snapshot,
      change_summary: dto.change_summary ?? null,
      is_major: dto.is_major ?? false,
      created_by_id: userId,
    });

    await this.versionRepo.save(version);
    return this.toResponse(version);
  }

  /**
   * List all versions for a document
   */
  async findAll(docId: string, userId: string): Promise<VersionResponseDto[]> {
    await this.requireAccess(docId, userId);

    const versions = await this.versionRepo.find({
      where: { document_id: docId },
      order: { version_number: 'DESC' },
    });

    return versions.map((v) => this.toResponse(v));
  }

  /**
   * Restore a document to a specific version
   */

  async restore(
    docId: string,
    versionId: string,
    userId: string,
  ): Promise<VersionResponseDto> {
    await this.requireAccess(docId, userId);

    const version = await this.versionRepo.findOne({
      where: { id: versionId, document_id: docId },
    });
    if (!version) throw new NotFoundException('Version not found');

    return this.dataSource.transaction(async (manager) => {
      // 1. Clear current blocks
      await manager.delete(DocumentBlock, { document_id: docId });

      // 2. Re-insert blocks from snapshot
      const newBlocks = version.blocks_snapshot.map((b, index) =>
        manager.create(DocumentBlock, {
          type: b.type,
          content: b.content,
          position: index,
          document_id: docId,
          last_edited_by_id: userId,
        }),
      );
      await manager.save(DocumentBlock, newBlocks);

      // 3. Calculate next INTEGER version number safely
      const maxVer = await manager.findOne(DocumentVersion, {
        where: { document_id: docId },
        order: { version_number: 'DESC' },
      });
      const nextVersionNumber = (maxVer?.version_number ?? 0) + 1;

      // 4. Save restore record (integer version + clear audit trail)
      const restoreVersion = manager.create(DocumentVersion, {
        document_id: docId,
        version_number: nextVersionNumber,
        blocks_snapshot: version.blocks_snapshot,
        change_summary: `Restored from version ${version.version_number}`,
        is_major: true, // Treat restores as important checkpoints
        created_by_id: userId,
      });

      await manager.save(DocumentVersion, restoreVersion);
      return this.toResponse(restoreVersion);
    });
  }

  private toResponse(v: DocumentVersion): VersionResponseDto {
    return {
      id: v.id,
      version_number: v.version_number,
      change_summary: v.change_summary,
      is_major: v.is_major,
      created_by: v.created_by_id,
      created_at: v.created_at,
      block_count: v.blocks_snapshot.length,
    };
  }
}
