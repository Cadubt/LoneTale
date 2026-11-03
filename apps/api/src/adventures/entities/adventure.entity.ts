import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { LONETALE_SCHEMA } from '../../config/configuration';
import { AdventureVersion } from './adventure-version.entity';

export type AdventureStatus = 'draft' | 'published' | 'archived';
export type AdventureVisibility = 'private' | 'unlisted' | 'public';

/**
 * Aventura: a identidade estavel da obra.
 *
 * O conteudo nao vive aqui, e sim em `AdventureVersions`. Isso mantem as
 * versoes publicadas imutaveis e permite que uma partida iniciada na 1.0
 * continue lendo a 1.0 depois de a 1.1 ser publicada.
 */
@Entity({ schema: LONETALE_SCHEMA, name: 'Adventures' })
@Index('IX_Adventures_Slug', ['slug'], { unique: true })
@Index('IX_Adventures_OwnerId', ['ownerId'])
@Index('IX_Adventures_Status_Visibility', ['status', 'visibility'])
export class Adventure {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** `metadata.id` do documento: identificador legivel e estavel da obra. */
  @Column({ type: 'nvarchar', length: 80 })
  slug: string;

  @Column({ type: 'nvarchar', length: 200 })
  title: string;

  @Column({ type: 'nvarchar', length: 500, nullable: true })
  summary: string | null;

  @Column({ type: 'uniqueidentifier' })
  ownerId: string;

  @Column({ type: 'nvarchar', length: 16, default: 'draft' })
  status: AdventureStatus;

  @Column({ type: 'nvarchar', length: 16, default: 'private' })
  visibility: AdventureVisibility;

  @Column({ type: 'nvarchar', length: 10, default: 'pt-BR' })
  language: string;

  /** Versao publicada em vigor para novas partidas. */
  @Column({ type: 'uniqueidentifier', nullable: true })
  currentVersionId: string | null;

  /** Versao em edicao no Studio. */
  @Column({ type: 'uniqueidentifier', nullable: true })
  draftVersionId: string | null;

  @Column({ type: 'nvarchar', length: 80, nullable: true })
  coverAssetId: string | null;

  @CreateDateColumn({ type: 'datetime2' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime2' })
  updatedAt: Date;

  @OneToMany(() => AdventureVersion, (version) => version.adventure)
  versions?: AdventureVersion[];
}
