import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { LONETALE_SCHEMA } from '../../config/configuration';

/**
 * Personagem criado por um jogador para uma aventura especifica.
 *
 * As colunas relacionais sao a projecao consultavel (listas, filtros,
 * estatisticas); a ficha completa, incluindo aparencia e atributos derivados,
 * vive no snapshot da partida. Aqui guardamos tambem a aparencia escolhida,
 * porque ela deve sobreviver ao fim da partida para gerar retratos depois.
 */
@Entity({ schema: LONETALE_SCHEMA, name: 'Characters' })
@Index('IX_Characters_UserId', ['userId'])
@Index('IX_Characters_Adventure', ['adventureId', 'userId'])
export class Character {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uniqueidentifier' })
  userId: string;

  @Column({ type: 'uniqueidentifier' })
  adventureId: string;

  /** Versao de conteudo a que este personagem esta preso. */
  @Column({ type: 'uniqueidentifier' })
  adventureVersionId: string;

  @Column({ type: 'nvarchar', length: 40 })
  name: string;

  @Column({ type: 'nvarchar', length: 80, nullable: true })
  classId: string | null;

  @Column({ type: 'nvarchar', length: 80, nullable: true })
  raceId: string | null;

  @Column({ type: 'int', default: 1 })
  level: number;

  @Column({ type: 'int', default: 0 })
  experience: number;

  /** Aparencia escolhida (JSON), preservada para retratos futuros. */
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  appearance: string | null;

  @Column({ type: 'nvarchar', length: 500, nullable: true })
  description: string | null;

  @CreateDateColumn({ type: 'datetime2' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime2' })
  updatedAt: Date;
}
