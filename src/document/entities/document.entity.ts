import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Workspace } from '../../workspace/entities/workspace.entity';
import { User } from '../../user/user.entity';
import { DocumentBlock } from './document-block.entity';
// import { DocumentBlock } from './document-block.entity'; // We'll create this next

@Entity('documents')
@Index(['workspace_id', 'title']) // Fast lookup by workspace + title
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  content_preview!: string | null; // First ~200 chars for list views

  // Relations
  @ManyToOne(() => Workspace, (workspace) => workspace.documents, {
    eager: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Workspace;

  @Column({ name: 'workspace_id' })
  workspace_id!: string;

  @ManyToOne(() => User, { eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  created_by_user!: User | null;

  @Column({ name: 'created_by', nullable: true })
  created_by!: string | null;

  // Blocks contain the actual document content (for collaborative editing)
  @OneToMany(() => DocumentBlock, (block) => block.document, { cascade: true })
  blocks!: DocumentBlock[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deleted_at!: Date | null;
}
