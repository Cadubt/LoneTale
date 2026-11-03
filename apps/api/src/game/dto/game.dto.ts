import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const PLAYER_ACTION_TYPES = [
  'choose',
  'continue',
  'rollSkillCheck',
  'combatAttack',
  'combatSkill',
  'combatItem',
  'combatFlee',
  'buyItem',
  'sellItem',
  'useItem',
  'equipItem',
  'unequipItem',
  'allocateAttribute',
  'restoreCheckpoint',
] as const;

export class CharacterDraftDto {
  @ApiProperty({ example: 'Ysolde das Cinzas', maxLength: 40 })
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do personagem.' })
  @MaxLength(40)
  name: string;

  @ApiPropertyOptional({ example: 'mago' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  classId?: string;

  @ApiPropertyOptional({ example: 'elfo' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  raceId?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { forca: 11, destreza: 13, inteligencia: 14, constituicao: 10 },
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, number>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { 'cor-da-pele': 'morena', altura: 168 },
  })
  @IsOptional()
  @IsObject()
  appearance?: Record<string, string | number | boolean | null>;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class StartSessionDto {
  @ApiProperty({ description: 'Identificador ou slug da aventura publicada.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  adventure: string;

  @ApiProperty({ type: CharacterDraftDto })
  @ValidateNested()
  @Type(() => CharacterDraftDto)
  character: CharacterDraftDto;
}

export class PlayerActionDto {
  @ApiProperty({ enum: PLAYER_ACTION_TYPES })
  @IsIn(PLAYER_ACTION_TYPES)
  type: (typeof PLAYER_ACTION_TYPES)[number];

  @ApiProperty({
    description:
      'Sequencia que o cliente acredita ser a atual. Acoes fora de ordem sao recusadas, o que impede que recarregar a pagina ou reenviar a requisicao duplique recompensas.',
    example: 3,
  })
  @IsInt()
  @Min(0)
  expectedSequence: number;

  @ApiPropertyOptional({
    description:
      'Chave de idempotencia gerada pelo cliente (UUID). Reenviar a mesma chave devolve o resultado original, sem aplicar a acao de novo.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'No a que a escolha pertence (acao "choose").' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nodeId?: string;

  @ApiPropertyOptional({ description: 'Escolha selecionada (acao "choose").' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  choiceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  itemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  skillId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  attributeId?: string;

  @ApiPropertyOptional({ description: 'Instancia de criatura visada em combate.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  targetInstanceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  slot?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 999 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  quantity?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 99 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  points?: number;
}

export class SessionSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  adventureId: string;

  @ApiProperty()
  adventureTitle: string;

  @ApiProperty()
  adventureSlug: string;

  @ApiProperty()
  adventureVersion: string;

  @ApiProperty()
  characterName: string;

  @ApiProperty()
  characterLevel: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  currentNodeId: string;

  @ApiProperty()
  sequence: number;

  @ApiPropertyOptional()
  endingId?: string | null;

  @ApiProperty()
  playtimeSeconds: number;

  @ApiProperty()
  startedAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
