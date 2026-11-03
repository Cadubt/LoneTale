import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { LONETALE_SCHEMA } from '../../config/configuration';

/**
 * Projecao relacional do inventario e do equipamento.
 *
 * A fonte da verdade e o snapshot da partida (o motor opera sobre ele de forma
 * transacional). Esta tabela e reescrita dentro da mesma transacao e existe
 * para o que SQL faz melhor: consultar, filtrar e agregar -- "quantos jogadores
 * carregam a corda?", "qual item e mais equipado?".
 */
@Entity({ schema: LONETALE_SCHEMA, name: 'CharacterInventory' })
@Index('IX_CharacterInventory_Session', ['gameSessionId'])
@Index('IX_CharacterInventory_Session_Item', ['gameSessionId', 'itemId'], { unique: true })
@Index('IX_CharacterInventory_Item', ['itemId'])
export class CharacterInventoryRow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uniqueidentifier' })
  gameSessionId: string;

  @Column({ type: 'uniqueidentifier' })
  characterId: string;

  @Column({ type: 'nvarchar', length: 80 })
  itemId: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'bit', default: false })
  equipped: boolean;

  @Column({ type: 'nvarchar', length: 40, nullable: true })
  slot: string | null;

  @UpdateDateColumn({ type: 'datetime2' })
  updatedAt: Date;
}
