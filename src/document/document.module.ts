import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentBlock } from './entities/document-block.entity';
import { Document } from './entities/document.entity';
import { WorkspaceMemberModule } from 'src/workspace-member/workspace-member.module';
import { DocumentBlockController } from './document-block.controller';
import { DocumentBlockService } from './document-block.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentBlock]),
    WorkspaceMemberModule,
  ],
  controllers: [DocumentController, DocumentBlockController],
  providers: [DocumentService, DocumentBlockService],
  exports: [DocumentService, DocumentBlockService],
})
export class DocumentModule {}
