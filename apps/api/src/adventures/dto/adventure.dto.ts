import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import type { AdventureVisibility } from '../entities/adventure.entity';

export class UpsertAdventureDocumentDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Documento completo da aventura, conforme o JSON Schema versionado (GET /api/adventures/schema).',
  })
  @IsObject({ message: 'O documento deve ser um objeto JSON.' })
  document: Record<string, unknown>;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  releaseNotes?: string;
}

export class CreateAdventureVersionDto extends UpsertAdventureDocumentDto {
  @ApiProperty({
    example: '1.1.0',
    description: 'Versao de conteudo da nova revisao. Deve ser maior que a anterior.',
  })
  @IsString()
  @Matches(/^\d+\.\d+(\.\d+)?$/, { message: 'Use o formato semver, ex.: 1.1.0.' })
  version: string;
}

export class PublishAdventureDto {
  @ApiProperty({ enum: ['private', 'unlisted', 'public'] })
  @IsIn(['private', 'unlisted', 'public'])
  visibility: AdventureVisibility;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  releaseNotes?: string;
}

export class ValidateAdventureDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  document: Record<string, unknown>;
}

export class ListCatalogQueryDto {
  @ApiPropertyOptional({ example: 'ponte' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @ApiPropertyOptional({ example: 'fantasia' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  genre?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class ValidationIssueDto {
  @ApiProperty({ enum: ['error', 'warning'] })
  severity: string;

  @ApiProperty({ example: 'ref.missing' })
  code: string;

  @ApiProperty({ example: 'nodes[3].choices[1].conditions.itemId' })
  path: string;

  @ApiProperty()
  message: string;
}

export class ValidationResultDto {
  @ApiProperty()
  valid: boolean;

  @ApiProperty({ type: [ValidationIssueDto] })
  errors: ValidationIssueDto[];

  @ApiProperty({ type: [ValidationIssueDto] })
  warnings: ValidationIssueDto[];
}

export class AdventureSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  summary?: string | null;

  @ApiProperty({ enum: ['draft', 'published', 'archived'] })
  status: string;

  @ApiProperty({ enum: ['private', 'unlisted', 'public'] })
  visibility: string;

  @ApiPropertyOptional({ description: 'Versao publicada em vigor.' })
  publishedVersion?: string | null;

  @ApiPropertyOptional({ description: 'Versao em edicao no Studio.' })
  draftVersion?: string | null;

  @ApiProperty()
  language: string;

  @ApiProperty()
  updatedAt: Date;
}

export class CatalogEntryDto {
  @ApiProperty()
  adventureId: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  summary?: string | null;

  @ApiProperty()
  version: string;

  @ApiPropertyOptional()
  estimatedMinutes?: number;

  @ApiPropertyOptional()
  difficulty?: string;

  @ApiProperty({ type: [String] })
  genre: string[];

  @ApiPropertyOptional()
  coverImageSrc?: string | null;

  @ApiProperty()
  publishedAt: Date | null;
}

export class PaginatedDto<T> {
  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  items: T[];
}

export class ImportAdventureDto extends UpsertAdventureDocumentDto {
  @ApiPropertyOptional({
    default: false,
    description: 'Publica imediatamente apos importar, se o documento for valido.',
  })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;

  @ApiPropertyOptional({ enum: ['private', 'unlisted', 'public'], default: 'private' })
  @IsOptional()
  @IsIn(['private', 'unlisted', 'public'])
  visibility?: AdventureVisibility;
}

export class AdventureVersionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  version: string;

  @ApiProperty()
  schemaVersion: string;

  @ApiProperty({ enum: ['draft', 'published', 'deprecated'] })
  status: string;

  @ApiProperty()
  nodeCount: number;

  @ApiProperty()
  checksum: string;

  @ApiPropertyOptional()
  releaseNotes?: string | null;

  @ApiPropertyOptional()
  publishedAt?: Date | null;

  @ApiProperty()
  createdAt: Date;
}

export class AdventureIdParamDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;
}
