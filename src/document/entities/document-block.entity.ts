import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Document } from './document.entity';
import { User } from '../../user/user.entity';

export enum BlockType {
  PARAGRAPH = 'paragraph',
  HEADING_1 = 'heading_1',
  HEADING_2 = 'heading_2',
  HEADING_3 = 'heading_3',
  BULLET_LIST = 'bullet_list',
  NUMBERED_LIST = 'numbered_list',
  CODE = 'code',
  IMAGE = 'image',
  QUOTE = 'quote',
  DIVIDER = 'divider',
}

@Entity('document_blocks')
@Index(['document_id', 'position']) // Fast ordering within a document
export class DocumentBlock {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: BlockType,
    default: BlockType.PARAGRAPH,
  })
  type!: BlockType;

  // The actual content (JSON for rich text, string for simple blocks)
  @Column({ type: 'jsonb', nullable: true })
  content!: Record<string, any> | string | null;

  // Position determines render order (0 = top, 1 = next, etc.)
  @Column({ type: 'integer', default: 0 })
  position!: number;

  // Relations
  @ManyToOne(() => Document, (document) => document.blocks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'document_id' })
  document!: Document;

  @Column({ name: 'document_id' })
  document_id!: string;

  // Track who last edited this block (for presence/cursors)
  @ManyToOne(() => User, { eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'last_edited_by' })
  last_edited_by!: User | null;

  @Column({ name: 'last_edited_by', nullable: true })
  last_edited_by_id!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
