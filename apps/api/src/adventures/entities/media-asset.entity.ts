import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { LONETALE_SCHEMA } from '../../config/configuration';

export type MediaKind = 'image' | 'audio' | 'video' | 'model';

/**
 * Midia associada a uma aventura.
 *
 * O arquivo em si fica em armazenamento externo (disco, S3, CDN); aqui vive
 * apenas o metadado e a chave publica usada pelo documento JSON em `assets`.
 */
@Entity({ schema: LONETALE_SCHEMA, name: 'MediaAssets' })
@Index('IX_MediaAssets_Adventure_AssetId', ['adventureId', 'assetId'], { unique: true })
@Index('IX_MediaAssets_Kind', ['kind'])
export class MediaAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uniqueidentifier' })
  adventureId: string;

  /** `assets[].id` referenciado pelo documento da aventura. */
  @Column({ type: 'nvarchar', length: 80 })
  assetId: string;

  @Column({ type: 'nvarchar', length: 16 })
  kind: MediaKind;

  @Column({ type: 'nvarchar', length: 1000 })
  src: string;

  @Column({ type: 'nvarchar', length: 300, nullable: true })
  alt: string | null;

  @Column({ type: 'nvarchar', length: 200, nullable: true })
  credit: string | null;

  @Column({ type: 'nvarchar', length: 100, nullable: true })
  contentType: string | null;

  @Column({ type: 'bigint', nullable: true })
  sizeBytes: string | null;

  @Column({ type: 'int', nullable: true })
  width: number | null;

  @Column({ type: 'int', nullable: true })
  height: number | null;

  @Column({ type: 'int', nullable: true })
  durationMs: number | null;

  @Column({ type: 'uniqueidentifier' })
  uploadedBy: string;

  @CreateDateColumn({ type: 'datetime2' })
  createdAt: Date;
}
