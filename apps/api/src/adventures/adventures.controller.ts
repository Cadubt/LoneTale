import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ADVENTURE_JSON_SCHEMA, getCharacterCreationOptions } from '@lonetale/engine';

import { CurrentUser, Public, Roles } from '../auth/decorators';
import { RolesGuard } from '../auth/guards';
import type { RequestUser } from '../auth/jwt.strategy';
import { AdventuresService } from './adventures.service';
import {
  AdventureSummaryDto,
  AdventureVersionDto,
  CreateAdventureVersionDto,
  ImportAdventureDto,
  PublishAdventureDto,
  UpsertAdventureDocumentDto,
  ValidateAdventureDto,
  ValidationResultDto,
} from './dto/adventure.dto';

/**
 * Adventure Studio.
 *
 * Toda a criacao de conteudo acontece por aqui, enviando documentos JSON: nao
 * ha codigo de aventura dentro da aplicacao, e nenhuma historia exige deploy.
 */
@ApiTags('Adventure Studio')
@ApiBearerAuth()
@Controller('adventures')
@UseGuards(RolesGuard)
export class AdventuresController {
  constructor(private readonly adventures: AdventuresService) {}

  @Public()
  @Get('schema')
  @ApiOperation({
    summary: 'JSON Schema do documento de aventura.',
    description:
      'Contrato versionado que o Studio e ferramentas externas usam para validar e autocompletar.',
  })
  schema(): Record<string, unknown> {
    return ADVENTURE_JSON_SCHEMA;
  }

  @Public()
  @Post('validate')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Valida um documento sem gravar nada.',
    description:
      'Duas camadas: estrutura (JSON Schema) e semantica (integridade referencial, dados, alcancabilidade dos nos, idempotencia de efeitos).',
  })
  @ApiResponse({ status: 200, type: ValidationResultDto })
  validate(@Body() dto: ValidateAdventureDto): ValidationResultDto {
    return this.adventures.validate(dto.document);
  }

  @Get()
  @Roles('author', 'admin')
  @ApiOperation({ summary: 'Lista as aventuras do autor.' })
  @ApiResponse({ status: 200, type: [AdventureSummaryDto] })
  async list(@CurrentUser() user: RequestUser): Promise<AdventureSummaryDto[]> {
    const adventures = await this.adventures.findOwned(user);
    const summaries = await Promise.all(
      adventures.map(async (adventure) => {
        const versions = await this.adventures.listVersions(adventure.id);
        const published = versions.find((version) => version.id === adventure.currentVersionId);
        const draft = versions.find((version) => version.id === adventure.draftVersionId);
        return {
          id: adventure.id,
          slug: adventure.slug,
          title: adventure.title,
          summary: adventure.summary,
          status: adventure.status,
          visibility: adventure.visibility,
          publishedVersion: published?.version ?? null,
          draftVersion: draft?.version ?? null,
          language: adventure.language,
          updatedAt: adventure.updatedAt,
        };
      }),
    );
    return summaries;
  }

  @Post()
  @Roles('author', 'admin')
  @ApiOperation({ summary: 'Cria uma aventura a partir de um documento JSON.' })
  async create(@CurrentUser() user: RequestUser, @Body() dto: ImportAdventureDto) {
    const { adventure, version } = await this.adventures.create(user, {
      document: dto.document,
      ...(dto.releaseNotes !== undefined ? { releaseNotes: dto.releaseNotes } : {}),
    });

    if (dto.publish) {
      const published = await this.adventures.publish(user, adventure.id, {
        visibility: dto.visibility ?? 'private',
        ...(dto.releaseNotes !== undefined ? { releaseNotes: dto.releaseNotes } : {}),
      });
      return { adventureId: adventure.id, slug: adventure.slug, version: published.version, published: true };
    }

    return {
      adventureId: adventure.id,
      slug: adventure.slug,
      version: version.version,
      published: false,
    };
  }

  @Get(':id')
  @Roles('author', 'admin')
  @ApiOperation({ summary: 'Detalhes de uma aventura e suas versoes.' })
  async detail(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const adventure = await this.adventures.requireAdventure(id);
    this.adventures.assertCanEdit(adventure, user);
    return { adventure, versions: await this.adventures.listVersions(id) };
  }

  @Get(':id/versions/:versionId/document')
  @Roles('author', 'admin')
  @ApiOperation({ summary: 'Documento completo de uma versao.' })
  async document(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    const adventure = await this.adventures.requireAdventure(id);
    this.adventures.assertCanEdit(adventure, user);
    return this.adventures.getVersionDocument(id, versionId);
  }

  @Put(':id/draft')
  @Roles('author', 'admin')
  @ApiOperation({
    summary: 'Grava o rascunho em vigor.',
    description: 'Versoes publicadas sao imutaveis: abra uma nova versao para continuar editando.',
  })
  @ApiResponse({ status: 200, type: AdventureVersionDto })
  saveDraft(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpsertAdventureDocumentDto,
  ) {
    return this.adventures.saveDraft(user, id, {
      document: dto.document,
      ...(dto.releaseNotes !== undefined ? { releaseNotes: dto.releaseNotes } : {}),
    });
  }

  @Post(':id/versions')
  @Roles('author', 'admin')
  @ApiOperation({ summary: 'Abre uma nova versao de rascunho.' })
  @ApiResponse({ status: 201, type: AdventureVersionDto })
  createVersion(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CreateAdventureVersionDto,
  ) {
    return this.adventures.createVersion(user, id, {
      version: dto.version,
      document: dto.document,
      ...(dto.releaseNotes !== undefined ? { releaseNotes: dto.releaseNotes } : {}),
    });
  }

  @Post(':id/publish')
  @Roles('author', 'admin')
  @ApiOperation({
    summary: 'Publica o rascunho.',
    description:
      'A versao passa a ser imutavel. Partidas em andamento continuam na versao em que comecaram.',
  })
  @ApiResponse({ status: 201, type: AdventureVersionDto })
  publish(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: PublishAdventureDto,
  ) {
    return this.adventures.publish(user, id, {
      visibility: dto.visibility,
      ...(dto.releaseNotes !== undefined ? { releaseNotes: dto.releaseNotes } : {}),
    });
  }

  @Get(':id/assets')
  @Roles('author', 'admin')
  @ApiOperation({ summary: 'Midias declaradas pela aventura.' })
  async assets(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const adventure = await this.adventures.requireAdventure(id);
    this.adventures.assertCanEdit(adventure, user);
    return this.adventures.listAssets(id);
  }

  @Get(':id/character-creation')
  @Roles('author', 'admin')
  @ApiOperation({
    summary: 'Opcoes de criacao de personagem derivadas do documento.',
    description: 'Permite ao Studio pre-visualizar a tela que o jogador vera.',
  })
  async characterCreation(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Query('versionId') versionId?: string,
  ) {
    const adventure = await this.adventures.requireAdventure(id);
    this.adventures.assertCanEdit(adventure, user);
    const resolved = await this.adventures.resolveVersion(id, versionId ?? adventure.draftVersionId ?? undefined);
    return getCharacterCreationOptions(resolved.compiled);
  }

  @Delete(':id')
  @Roles('author', 'admin')
  @HttpCode(204)
  @ApiOperation({ summary: 'Arquiva a aventura (nao apaga historico nem partidas).' })
  async archive(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<void> {
    await this.adventures.archive(user, id);
  }
}
