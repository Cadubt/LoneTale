import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { LONETALE_SCHEMA } from '../../config/configuration';
import type { AdventureVisibility } from './adventure.entity';

/**
 * Registro historico de publicacoes.
 *
 * Mantido separado de `AdventureVersions` para preservar a trilha de auditoria
 * (quem publicou, quando, com que notas) mesmo que a visibilidade mude depois.
 */
@Entity({ schema: LONETALE_SCHEMA, name: 'AdventurePublications' })
@Index('IX_AdventurePublications_AdventureId', ['adventureId'])
@Index('IX_AdventurePublications_VersionId', ['adventureVersionId'])
export class AdventurePublication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uniqueidentifier' })
  adventureId: string;

  @Column({ type: 'uniqueidentifier' })
  adventureVersionId: string;

  @Column({ type: 'nvarchar', length: 20 })
  version: string;

  @Column({ type: 'nvarchar', length: 16 })
  visibility: AdventureVisibility;

  @Column({ type: 'nvarchar', length: 1000, nullable: true })
  releaseNotes: string | null;

  @Column({ type: 'uniqueidentifier' })
  publishedBy: string;

  @Column({ type: 'datetime2', nullable: true })
  retiredAt: Date | null;

  @CreateDateColumn({ type: 'datetime2' })
  publishedAt: Date;
}
