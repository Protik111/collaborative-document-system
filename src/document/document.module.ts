import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentBlock } from './entities/document-block.entity';
import { Document } from './entities/document.entity';
import { WorkspaceMemberModule } from 'src/workspace-member/workspace-member.module';
import { DocumentBlockController } from './document-block.controller';
import { DocumentBlockService } from './document-block.service';
import { DocumentVersion } from './entities/document-version.entity';
import { DocumentVersionController } from './document-version.controller';
import { DocumentVersionService } from './document-version.service';
import { DocumentsGateway } from './documents.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentBlock, DocumentVersion]),
    WorkspaceMemberModule,
  ],
  controllers: [
    DocumentController,
    DocumentBlockController,
    DocumentVersionController,
  ],
  providers: [
    DocumentService,
    DocumentBlockService,
    DocumentVersionService,
    DocumentsGateway,
  ],
  exports: [DocumentService, DocumentBlockService, DocumentVersionService],
})
export class DocumentModule {}
