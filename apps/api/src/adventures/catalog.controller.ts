import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { getCharacterCreationOptions } from '@lonetale/engine';

import { Public } from '../auth/decorators';
import { AdventuresService } from './adventures.service';
import { CatalogEntryDto, ListCatalogQueryDto } from './dto/adventure.dto';

/** Catalogo publico: o que um jogador pode comecar a jogar. */
@ApiTags('Catalogo')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly adventures: AdventuresService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lista as aventuras publicadas.' })
  @ApiResponse({ status: 200, type: [CatalogEntryDto] })
  list(@Query() query: ListCatalogQueryDto) {
    return this.adventures.catalog({
      ...(query.search !== undefined ? { search: query.search } : {}),
      ...(query.genre !== undefined ? { genre: query.genre } : {}),
      ...(query.page !== undefined ? { page: query.page } : {}),
      ...(query.pageSize !== undefined ? { pageSize: query.pageSize } : {}),
    });
  }

  @Public()
  @Get(':slug')
  @ApiOperation({
    summary: 'Detalhes de uma aventura publicada, com as opcoes de criacao de personagem.',
    description:
      'As restricoes de classe, especie, atributos e aparencia vem do documento: uma historia pode exigir um mago humano, outra liberar tudo.',
  })
  async detail(@Param('slug') slug: string) {
    const page = await this.adventures.catalog({ pageSize: 100, includeUnlisted: true });
    const entry = page.items.find((item) => item.slug === slug);
    if (!entry) {
      throw new NotFoundException('Aventura nao encontrada no catalogo.');
    }

    const resolved = await this.adventures.resolveVersion(entry.adventureId);
    const metadata = resolved.compiled.doc.metadata;

    return {
      ...entry,
      adventureVersionId: resolved.version.id,
      description: metadata.description ?? null,
      world: metadata.world ?? null,
      tags: metadata.tags ?? [],
      contentWarnings: metadata.contentWarnings ?? [],
      ageRating: metadata.ageRating ?? null,
      ruleset: {
        id: resolved.compiled.doc.ruleset.id,
        name: resolved.compiled.doc.ruleset.name,
        description: resolved.compiled.doc.ruleset.description ?? null,
        combatEnabled: resolved.compiled.doc.ruleset.combat.enabled,
        progressionEnabled: resolved.compiled.doc.ruleset.progression.enabled,
      },
      characterCreation: getCharacterCreationOptions(resolved.compiled),
    };
  }
}
