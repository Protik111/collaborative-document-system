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
import { User } from '../../user/entities/user.entity';
import { WorkspaceMember } from 'src/workspace-member/entities/workspace-member.entity';
import { Document } from 'src/document/entities/document.entity';

@Entity('workspaces')
@Index(['name', 'owner_id'], { unique: true }) // Prevent duplicate names per owner
export class Workspace {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  // Owner is a user who has full control
  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner!: User;

  @Column({ name: 'owner_id' })
  owner_id!: string;

  // Relations
  @OneToMany(() => WorkspaceMember, (member) => member.workspace, {
    cascade: true,
  })
  members!: WorkspaceMember[];

  @OneToMany(() => Document, (doc) => doc.workspace)
  documents!: Document[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deleted_at!: Date | null;
}
