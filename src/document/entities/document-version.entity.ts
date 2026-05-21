import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Document } from './document.entity';
import { User } from '../../user/entities/user.entity';

@Entity('document_versions')
@Index(['document_id', 'version_number'], { unique: true }) // Prevent duplicate version numbers per doc
export class DocumentVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document!: Document;

  @Column({ name: 'document_id' })
  document_id!: string;

  @Column({ type: 'integer' })
  version_number!: number; // 1, 2, 3...

  // Snapshot of all blocks at the time of this version
  @Column({ type: 'jsonb' })
  blocks_snapshot!: Record<string, any>[];

  @Column({ type: 'varchar', length: 200, nullable: true })
  change_summary!: string | null; // e.g., "Added Q1 metrics section"

  @Column({ default: false })
  is_major!: boolean; // Flag for important checkpoints (retained longer, shows in UI)

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  created_by!: User | null;

  @Column({ name: 'created_by', nullable: true })
  created_by_id!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
