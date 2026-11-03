import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  CompiledAdventure,
  validateAdventure,
  type AdventureDocument,
  type ValidationResult,
} from '@lonetale/engine';
import { createHash } from 'node:crypto';
import { DataSource, In, IsNull, Repository } from 'typeorm';

import type { UserRole } from '../users/entities/user.entity';
import { AdventureCacheService } from './adventure-cache.service';
import { AdventurePublication } from './entities/adventure-publication.entity';
import { AdventureVersion } from './entities/adventure-version.entity';
import { Adventure, type AdventureVisibility } from './entities/adventure.entity';
import { MediaAsset } from './entities/media-asset.entity';

export interface Actor {
  id: string;
  role: UserRole | string;
}

export interface ResolvedVersion {
  adventure: Adventure;
  version: AdventureVersion;
  compiled: CompiledAdventure;
}

/** Serializacao estavel (chaves ordenadas) para o checksum. */
function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalStringify(entryValue)}`);
  return `{${entries.join(',')}}`;
}

function checksumOf(document: AdventureDocument): string {
  return createHash('sha256').update(canonicalStringify(document)).digest('hex');
}

/** Compara versoes semver simples (1.2.3). */
function compareVersions(left: string, right: string): number {
  const parse = (value: string) => value.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let i = 0; i < 3; i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

@Injectable()
export class AdventuresService {
  private readonly logger = new Logger(AdventuresService.name);

  constructor(
    @InjectRepository(Adventure) private readonly adventures: Repository<Adventure>,
    @InjectRepository(AdventureVersion) private readonly versions: Repository<AdventureVersion>,
    @InjectRepository(AdventurePublication)
    private readonly publications: Repository<AdventurePublication>,
    @InjectRepository(MediaAsset) private readonly assets: Repository<MediaAsset>,
    private readonly cache: AdventureCacheService,
    private readonly dataSource: DataSource,
  ) {}

  // ------------------------------------------------------------- validacao
  /** Validacao pura, sem efeitos: usada pelo Studio antes de salvar. */
  validate(document: unknown): ValidationResult {
    return validateAdventure(document);
  }

  private assertValid(document: unknown): AdventureDocument {
    const result = validateAdventure(document);
    if (!result.valid) {
      throw new UnprocessableEntityException({
        message: 'A aventura nao passou na validacao do contrato.',
        code: 'ADVENTURE_INVALID',
        errors: result.errors,
        warnings: result.warnings,
      });
    }
    return document as AdventureDocument;
  }

  // -------------------------------------------------------------- consultas
  async findOwned(actor: Actor): Promise<Adventure[]> {
    if (actor.role === 'admin') {
      return this.adventures.find({ order: { updatedAt: 'DESC' } });
    }
    return this.adventures.find({ where: { ownerId: actor.id }, order: { updatedAt: 'DESC' } });
  }

  async requireAdventure(adventureId: string): Promise<Adventure> {
    const adventure = await this.adventures.findOne({ where: { id: adventureId } });
    if (!adventure) {
      throw new NotFoundException('Aventura nao encontrada.');
    }
    return adventure;
  }

  assertCanEdit(adventure: Adventure, actor: Actor): void {
    if (actor.role !== 'admin' && adventure.ownerId !== actor.id) {
      throw new ForbiddenException('Esta aventura pertence a outro autor.');
    }
  }

  listVersions(adventureId: string): Promise<AdventureVersion[]> {
    return this.versions.find({
      where: { adventureId },
      order: { createdAt: 'DESC' },
      select: [
        'id',
        'version',
        'schemaVersion',
        'status',
        'nodeCount',
        'checksum',
        'releaseNotes',
        'publishedAt',
        'createdAt',
      ],
    });
  }

  async getVersionDocument(adventureId: string, versionId: string): Promise<AdventureDocument> {
    const version = await this.versions.findOne({ where: { id: versionId, adventureId } });
    if (!version) {
      throw new NotFoundException('Versao nao encontrada para esta aventura.');
    }
    return JSON.parse(version.document) as AdventureDocument;
  }

  /**
   * Resolve a versao compilada de uma aventura.
   *
   * Partidas em andamento informam o `versionId` ao qual estao presas; novas
   * partidas usam a versao publicada em vigor.
   */
  async resolveVersion(adventureId: string, versionId?: string): Promise<ResolvedVersion> {
    const adventure = await this.requireAdventure(adventureId);
    const targetId = versionId ?? adventure.currentVersionId;

    if (!targetId) {
      throw new ConflictException('Esta aventura ainda nao tem uma versao publicada.');
    }

    const cached = this.cache.get(targetId);
    const version = await this.versions.findOne({ where: { id: targetId, adventureId } });
    if (!version) {
      throw new NotFoundException('Versao da aventura nao encontrada.');
    }

    if (cached) {
      return { adventure, version, compiled: cached };
    }

    const document = JSON.parse(version.document) as AdventureDocument;
    const compiled = this.cache.set(version.id, document);
    return { adventure, version, compiled };
  }

  // ------------------------------------------------------------- escrita
  /**
   * Cria uma aventura a partir de um documento completo.
   *
   * A aventura nasce como rascunho privado: publicar e um ato separado e
   * explicito.
   */
  async create(
    actor: Actor,
    input: { document: unknown; releaseNotes?: string },
  ): Promise<{ adventure: Adventure; version: AdventureVersion }> {
    const document = this.assertValid(input.document);
    const slug = document.metadata.id;

    if (await this.adventures.findOne({ where: { slug } })) {
      throw new ConflictException(
        `Ja existe uma aventura com o identificador "${slug}". Altere metadata.id.`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const adventure = await manager.save(
        manager.create(Adventure, {
          slug,
          title: document.metadata.title,
          summary: document.metadata.summary ?? null,
          ownerId: actor.id,
          status: 'draft',
          visibility: 'private',
          language: document.metadata.language ?? 'pt-BR',
          currentVersionId: null,
          draftVersionId: null,
          coverAssetId: document.metadata.coverImage ?? null,
        }),
      );

      const version = await manager.save(
        manager.create(AdventureVersion, {
          adventureId: adventure.id,
          version: document.metadata.version,
          schemaVersion: document.schemaVersion,
          status: 'draft',
          document: JSON.stringify(document),
          checksum: checksumOf(document),
          nodeCount: document.nodes.length,
          releaseNotes: input.releaseNotes ?? null,
          createdBy: actor.id,
          publishedAt: null,
        }),
      );

      await manager.update(Adventure, adventure.id, { draftVersionId: version.id });
      await this.syncAssets(manager, adventure.id, document, actor.id);

      adventure.draftVersionId = version.id;
      this.logger.log(`Aventura criada: ${adventure.slug} (${adventure.id}).`);
      return { adventure, version };
    });
  }

  /**
   * Grava o rascunho em vigor.
   *
   * Versoes publicadas nao sao alteradas: se a versao atual ja foi publicada, o
   * autor precisa criar uma nova versao.
   */
  async saveDraft(
    actor: Actor,
    adventureId: string,
    input: { document: unknown; releaseNotes?: string },
  ): Promise<AdventureVersion> {
    const adventure = await this.requireAdventure(adventureId);
    this.assertCanEdit(adventure, actor);

    const document = this.assertValid(input.document);

    if (document.metadata.id !== adventure.slug) {
      throw new BadRequestException(
        `metadata.id nao pode mudar depois da criacao ("${adventure.slug}").`,
      );
    }

    if (!adventure.draftVersionId) {
      throw new ConflictException(
        'Esta aventura nao tem rascunho aberto. Crie uma nova versao para continuar editando.',
      );
    }

    const draft = await this.versions.findOne({ where: { id: adventure.draftVersionId } });
    if (!draft) {
      throw new NotFoundException('Rascunho nao encontrado.');
    }
    if (draft.status !== 'draft') {
      throw new ConflictException(
        `A versao ${draft.version} ja foi publicada e e imutavel. Crie uma nova versao.`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.update(AdventureVersion, draft.id, {
        version: document.metadata.version,
        schemaVersion: document.schemaVersion,
        document: JSON.stringify(document),
        checksum: checksumOf(document),
        nodeCount: document.nodes.length,
        releaseNotes: input.releaseNotes ?? draft.releaseNotes,
      });

      await manager.update(Adventure, adventure.id, {
        title: document.metadata.title,
        summary: document.metadata.summary ?? null,
        language: document.metadata.language ?? adventure.language,
        coverAssetId: document.metadata.coverImage ?? null,
      });

      await this.syncAssets(manager, adventure.id, document, actor.id);
      this.cache.invalidate(draft.id);

      return (await manager.findOne(AdventureVersion, { where: { id: draft.id } })) as AdventureVersion;
    });
  }

  /** Abre uma nova versao de rascunho, partindo do documento informado. */
  async createVersion(
    actor: Actor,
    adventureId: string,
    input: { version: string; document: unknown; releaseNotes?: string },
  ): Promise<AdventureVersion> {
    const adventure = await this.requireAdventure(adventureId);
    this.assertCanEdit(adventure, actor);

    const document = this.assertValid(input.document);

    if (document.metadata.version !== input.version) {
      throw new BadRequestException(
        `metadata.version ("${document.metadata.version}") precisa coincidir com a versao informada ("${input.version}").`,
      );
    }

    const existing = await this.versions.find({ where: { adventureId }, select: ['version', 'status'] });
    if (existing.some((entry) => entry.version === input.version)) {
      throw new ConflictException(`A versao ${input.version} ja existe nesta aventura.`);
    }
    const highest = existing
      .map((entry) => entry.version)
      .sort(compareVersions)
      .pop();
    if (highest && compareVersions(input.version, highest) <= 0) {
      throw new ConflictException(
        `A nova versao (${input.version}) deve ser maior que a mais recente (${highest}).`,
      );
    }
    if (existing.some((entry) => entry.status === 'draft')) {
      throw new ConflictException(
        'Ja existe um rascunho aberto. Publique-o ou descarte-o antes de abrir outra versao.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const version = await manager.save(
        manager.create(AdventureVersion, {
          adventureId,
          version: input.version,
          schemaVersion: document.schemaVersion,
          status: 'draft',
          document: JSON.stringify(document),
          checksum: checksumOf(document),
          nodeCount: document.nodes.length,
          releaseNotes: input.releaseNotes ?? null,
          createdBy: actor.id,
          publishedAt: null,
        }),
      );
      await manager.update(Adventure, adventureId, { draftVersionId: version.id });
      await this.syncAssets(manager, adventureId, document, actor.id);
      return version;
    });
  }

  /**
   * Publica o rascunho em vigor.
   *
   * A partir daqui a versao e imutavel: partidas iniciadas nela continuarao
   * lendo exatamente este documento, mesmo depois de versoes posteriores.
   */
  async publish(
    actor: Actor,
    adventureId: string,
    input: { visibility: AdventureVisibility; releaseNotes?: string },
  ): Promise<AdventureVersion> {
    const adventure = await this.requireAdventure(adventureId);
    this.assertCanEdit(adventure, actor);

    if (!adventure.draftVersionId) {
      throw new ConflictException('Nao ha rascunho para publicar.');
    }

    const draft = await this.versions.findOne({ where: { id: adventure.draftVersionId } });
    if (!draft) {
      throw new NotFoundException('Rascunho nao encontrado.');
    }
    if (draft.status !== 'draft') {
      throw new ConflictException(`A versao ${draft.version} ja foi publicada.`);
    }

    // Revalida antes de congelar: o documento pode ter sido gravado por uma
    // versao anterior da aplicacao, com regras de validacao mais brandas.
    const document = this.assertValid(JSON.parse(draft.document));
    const publishedAt = new Date();

    return this.dataSource.transaction(async (manager) => {
      await manager.update(AdventureVersion, draft.id, { status: 'published', publishedAt });

      if (adventure.currentVersionId && adventure.currentVersionId !== draft.id) {
        await manager.update(AdventureVersion, adventure.currentVersionId, { status: 'deprecated' });
        await manager.update(
          AdventurePublication,
          { adventureVersionId: adventure.currentVersionId, retiredAt: IsNull() },
          { retiredAt: publishedAt },
        );
      }

      await manager.save(
        manager.create(AdventurePublication, {
          adventureId,
          adventureVersionId: draft.id,
          version: draft.version,
          visibility: input.visibility,
          releaseNotes: input.releaseNotes ?? draft.releaseNotes,
          publishedBy: actor.id,
          retiredAt: null,
        }),
      );

      await manager.update(Adventure, adventureId, {
        status: 'published',
        visibility: input.visibility,
        currentVersionId: draft.id,
        // O rascunho foi consumido: continuar editando exige uma nova versao.
        draftVersionId: null,
      });

      this.cache.invalidate(draft.id);
      this.cache.set(draft.id, document);

      this.logger.log(
        `Aventura ${adventure.slug} publicada na versao ${draft.version} (${input.visibility}).`,
      );

      return (await manager.findOne(AdventureVersion, { where: { id: draft.id } })) as AdventureVersion;
    });
  }

  async archive(actor: Actor, adventureId: string): Promise<void> {
    const adventure = await this.requireAdventure(adventureId);
    this.assertCanEdit(adventure, actor);
    await this.adventures.update(adventureId, { status: 'archived', visibility: 'private' });
  }

  // -------------------------------------------------------------- catalogo
  /**
   * Catalogo de aventuras jogaveis.
   *
   * Le os metadados a partir do documento publicado, para que o catalogo mostre
   * exatamente o que a versao em vigor declara.
   */
  async catalog(options: {
    search?: string;
    genre?: string;
    page?: number;
    pageSize?: number;
    includeUnlisted?: boolean;
  }) {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));

    const visibilities: AdventureVisibility[] = options.includeUnlisted
      ? ['public', 'unlisted']
      : ['public'];

    const query = this.adventures
      .createQueryBuilder('adventure')
      .innerJoin(
        AdventureVersion,
        'version',
        'version.id = adventure.currentVersionId AND version.status = :published',
        { published: 'published' },
      )
      .where('adventure.status = :status', { status: 'published' })
      .andWhere('adventure.visibility IN (:...visibilities)', { visibilities })
      .orderBy('version.publishedAt', 'DESC');

    if (options.search) {
      query.andWhere('(adventure.title LIKE :search OR adventure.summary LIKE :search)', {
        search: `%${options.search}%`,
      });
    }

    const [rows, total] = await query
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const versionIds = rows
      .map((row) => row.currentVersionId)
      .filter((id): id is string => id !== null);
    const versions = versionIds.length
      ? await this.versions.find({ where: { id: In(versionIds) } })
      : [];
    const byId = new Map(versions.map((version) => [version.id, version]));

    const items = rows.flatMap((adventure) => {
      const version = adventure.currentVersionId ? byId.get(adventure.currentVersionId) : undefined;
      if (!version) {
        return [];
      }
      const document = JSON.parse(version.document) as AdventureDocument;
      if (options.genre && !(document.metadata.genre ?? []).includes(options.genre)) {
        return [];
      }
      const cover = document.metadata.coverImage
        ? (document.assets ?? []).find((asset) => asset.id === document.metadata.coverImage)
        : undefined;

      return [
        {
          adventureId: adventure.id,
          slug: adventure.slug,
          title: document.metadata.title,
          summary: document.metadata.summary ?? null,
          version: version.version,
          ...(document.metadata.estimatedMinutes !== undefined
            ? { estimatedMinutes: document.metadata.estimatedMinutes }
            : {}),
          ...(document.metadata.difficulty !== undefined
            ? { difficulty: document.metadata.difficulty }
            : {}),
          genre: document.metadata.genre ?? [],
          coverImageSrc: cover?.src ?? null,
          publishedAt: version.publishedAt,
        },
      ];
    });

    return { total, page, pageSize, items };
  }

  /**
   * Espelha `assets` do documento na tabela de midia.
   *
   * O documento continua sendo a fonte da verdade para o motor; a tabela existe
   * para o Studio listar, auditar e limpar arquivos orfaos.
   */
  private async syncAssets(
    manager: DataSource['manager'],
    adventureId: string,
    document: AdventureDocument,
    userId: string,
  ): Promise<void> {
    const declared = document.assets ?? [];
    const existing = await manager.find(MediaAsset, { where: { adventureId } });
    const existingByAssetId = new Map(existing.map((asset) => [asset.assetId, asset]));

    for (const asset of declared) {
      const current = existingByAssetId.get(asset.id);
      const values = {
        kind: asset.kind,
        src: asset.src,
        alt: asset.alt ?? null,
        credit: asset.credit ?? null,
        width: asset.width ?? null,
        height: asset.height ?? null,
        durationMs: asset.durationMs ?? null,
      };
      if (current) {
        await manager.update(MediaAsset, current.id, values);
      } else {
        await manager.save(
          manager.create(MediaAsset, {
            adventureId,
            assetId: asset.id,
            uploadedBy: userId,
            contentType: null,
            sizeBytes: null,
            ...values,
          }),
        );
      }
    }
  }

  listAssets(adventureId: string): Promise<MediaAsset[]> {
    return this.assets.find({ where: { adventureId }, order: { assetId: 'ASC' } });
  }
}
