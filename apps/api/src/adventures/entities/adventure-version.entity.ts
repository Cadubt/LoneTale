import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { LONETALE_SCHEMA } from '../../config/configuration';
import { Adventure } from './adventure.entity';

export type AdventureVersionStatus = 'draft' | 'published' | 'deprecated';

/**
 * Uma versao de conteudo da aventura.
 *
 * `document` guarda o JSON completo em NVARCHAR(MAX), validado contra o JSON
 * Schema versionado antes de ser gravado. Uma vez publicada, a linha e tratada
 * como imutavel: alteracoes exigem uma nova versao.
 */
@Entity({ schema: LONETALE_SCHEMA, name: 'AdventureVersions' })
@Index('IX_AdventureVersions_Adventure_Version', ['adventureId', 'version'], { unique: true })
@Index('IX_AdventureVersions_Status', ['status'])
export class AdventureVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uniqueidentifier' })
  adventureId: string;

  /** Versao de conteudo (semver), ex.: "1.0.0". */
  @Column({ type: 'nvarchar', length: 20 })
  version: string;

  /** Versao do contrato JSON a que o documento obedece. */
  @Column({ type: 'nvarchar', length: 20 })
  schemaVersion: string;

  @Column({ type: 'nvarchar', length: 16, default: 'draft' })
  status: AdventureVersionStatus;

  /**
   * Documento completo da aventura.
   * A integridade estrutural e garantida pela aplicacao (JSON Schema) e
   * reforcada por uma constraint `ISJSON` criada na migration.
   */
  @Column({ type: 'nvarchar', length: 'MAX' })
  document: string;

  /** SHA-256 do documento normalizado; detecta alteracao indevida. */
  @Column({ type: 'nvarchar', length: 64 })
  checksum: string;

  @Column({ type: 'int', default: 0 })
  nodeCount: number;

  @Column({ type: 'nvarchar', length: 1000, nullable: true })
  releaseNotes: string | null;

  @Column({ type: 'uniqueidentifier' })
  createdBy: string;

  @Column({ type: 'datetime2', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ type: 'datetime2' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime2' })
  updatedAt: Date;

  @ManyToOne(() => Adventure, (adventure) => adventure.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'adventureId' })
  adventure?: Adventure;
}
