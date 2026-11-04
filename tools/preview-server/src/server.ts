/**
 * Servidor de pre-visualizacao do LoneTale.
 *
 * ISTO NAO E A API. E uma ferramenta de desenvolvimento que responde ao mesmo
 * contrato HTTP usando o **motor de aventuras real**, com tudo em memoria e sem
 * SQL Server. Serve para jogar a aventura do comeco ao fim e avaliar conteudo,
 * texto, balanceamento e interface antes de encostar no banco de dados.
 *
 * O que e real aqui: condicoes, efeitos, rolagens, combate, checkpoints,
 * progressao, finais e a projecao enviada ao cliente -- tudo vem de
 * `@lonetale/engine`, o mesmo codigo que a API usa.
 *
 * O que e fingido: autenticacao (um unico usuario fixo), catalogo (uma
 * aventura, lida de um arquivo), versionamento e persistencia (um JSON em
 * disco). Nenhuma dessas partes deve ser usada como referencia de
 * comportamento de producao.
 *
 *   npm run dev:preview
 */
import {
  ADVENTURE_JSON_SCHEMA,
  AdventureEngine,
  EngineError,
  compileAdventure,
  getCharacterCreationOptions,
  validateAdventure,
  type AdventureDocument,
  type CharacterDraft,
  type GameState,
  type PlayerAction,
} from '@lonetale/engine';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

import { placeholderSvg } from './placeholder-image';

// ---------------------------------------------------------------------------
// Guardas
// ---------------------------------------------------------------------------

if (process.env.NODE_ENV === 'production') {
  process.stderr.write(
    '[preview] Recusando iniciar com NODE_ENV=production. Este servidor nao tem autenticacao real.\n',
  );
  process.exit(1);
}

const ROOT = resolve(__dirname, '..', '..', '..');
const PORT = Number.parseInt(process.env.PREVIEW_PORT ?? '3333', 10);
const ADVENTURE_PATH = resolve(
  ROOT,
  process.env.PREVIEW_ADVENTURE ?? 'adventures/ponte-das-sombras/aventura.json',
);
const DATA_FILE = resolve(__dirname, '..', '.data', 'sessions.json');

// ---------------------------------------------------------------------------
// Aventura
// ---------------------------------------------------------------------------

function loadAdventure(): AdventureDocument {
  if (!existsSync(ADVENTURE_PATH)) {
    throw new Error(`Aventura nao encontrada em ${ADVENTURE_PATH}`);
  }
  const document = JSON.parse(readFileSync(ADVENTURE_PATH, 'utf8')) as AdventureDocument;
  const result = validateAdventure(document);

  if (!result.valid) {
    process.stderr.write(`[preview] A aventura tem ${result.errors.length} erro(s):\n`);
    for (const issue of result.errors) {
      process.stderr.write(`  - ${issue.path}: ${issue.message}\n`);
    }
    throw new Error('Corrija os erros antes de pre-visualizar.');
  }
  if (result.warnings.length > 0) {
    process.stdout.write(`[preview] ${result.warnings.length} aviso(s) de validacao:\n`);
    for (const issue of result.warnings) {
      process.stdout.write(`  - ${issue.path}: ${issue.message}\n`);
    }
  }
  return document;
}

const document = loadAdventure();
const compiled = compileAdventure(document);
const engine = new AdventureEngine(compiled);

const ADVENTURE_ID = 'preview-adventure';
const VERSION_ID = 'preview-version';

// ---------------------------------------------------------------------------
// Estado em memoria, espelhado em disco
// ---------------------------------------------------------------------------

interface StoredEvent {
  id: string;
  sequence: number;
  ordinal: number;
  kind: string;
  nodeId: string | null;
  actionType: string | null;
  payload: string;
  createdAt: string;
}

interface StoredSession {
  id: string;
  state: GameState;
  characterName: string;
  startedAt: string;
  updatedAt: string;
  playtimeSeconds: number;
  /** Log da partida, do mais recente para o mais antigo. */
  events: StoredEvent[];
}

/** Quantos eventos manter por partida na pre-visualizacao. */
const MAX_STORED_EVENTS = 300;

function toStoredEvents(
  sequence: number,
  actionType: string,
  nodeId: string,
  events: readonly unknown[],
): StoredEvent[] {
  const now = new Date().toISOString();
  return events.map((event, index) => ({
    id: randomUUID(),
    sequence,
    ordinal: index,
    kind: (event as { type?: string }).type ?? 'unknown',
    nodeId: ((event as { nodeId?: string }).nodeId ?? nodeId) || null,
    actionType,
    payload: JSON.stringify(event),
    createdAt: now,
  }));
}

const sessions = new Map<string, StoredSession>();

function loadSessions(): void {
  if (!existsSync(DATA_FILE)) {
    return;
  }
  try {
    const raw = JSON.parse(readFileSync(DATA_FILE, 'utf8')) as StoredSession[];
    for (const entry of raw) {
      // Partidas gravadas por uma versao anterior da aventura sao descartadas:
      // o estado so faz sentido junto do documento que o gerou.
      if (entry.state?.adventureVersion === document.metadata.version) {
        sessions.set(entry.id, { ...entry, events: entry.events ?? [] });
      }
    }
    process.stdout.write(`[preview] ${sessions.size} partida(s) recuperada(s) do disco.\n`);
  } catch (error) {
    process.stderr.write(`[preview] Nao foi possivel ler ${DATA_FILE}: ${(error as Error).message}\n`);
  }
}

function saveSessions(): void {
  try {
    mkdirSync(dirname(DATA_FILE), { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify([...sessions.values()], null, 2), 'utf8');
  } catch (error) {
    process.stderr.write(`[preview] Falha ao gravar partidas: ${(error as Error).message}\n`);
  }
}

loadSessions();

// ---------------------------------------------------------------------------
// Usuario fixo
// ---------------------------------------------------------------------------

const USER = {
  id: 'preview-user',
  email: 'preview@lonetale.local',
  displayName: 'Jogador de Pre-visualizacao',
  role: 'author',
  locale: 'pt-BR',
} as const;

const sessionPayload = () => ({
  accessToken: 'preview-access-token',
  refreshToken: 'preview-refresh-token',
  expiresIn: 900,
  tokenType: 'Bearer',
  user: USER,
});

// ---------------------------------------------------------------------------
// Projecoes do catalogo e do Studio
// ---------------------------------------------------------------------------

function coverSrc(): string | null {
  const id = document.metadata.coverImage;
  if (!id) {
    return null;
  }
  const asset = (document.assets ?? []).find((entry) => entry.id === id);
  return asset?.src ?? null;
}

const catalogEntry = () => ({
  adventureId: ADVENTURE_ID,
  slug: document.metadata.id,
  title: document.metadata.title,
  summary: document.metadata.summary ?? null,
  version: document.metadata.version,
  estimatedMinutes: document.metadata.estimatedMinutes,
  difficulty: document.metadata.difficulty,
  genre: document.metadata.genre ?? [],
  coverImageSrc: coverSrc(),
  publishedAt: new Date().toISOString(),
});

const catalogDetail = () => ({
  ...catalogEntry(),
  adventureVersionId: VERSION_ID,
  description: document.metadata.description ?? null,
  world: document.metadata.world ?? null,
  tags: document.metadata.tags ?? [],
  contentWarnings: document.metadata.contentWarnings ?? [],
  ageRating: document.metadata.ageRating ?? null,
  ruleset: {
    id: document.ruleset.id,
    name: document.ruleset.name,
    description: document.ruleset.description ?? null,
    combatEnabled: document.ruleset.combat.enabled,
    progressionEnabled: document.ruleset.progression.enabled,
  },
  characterCreation: getCharacterCreationOptions(compiled),
});

const adventureSummary = () => ({
  id: ADVENTURE_ID,
  slug: document.metadata.id,
  title: document.metadata.title,
  summary: document.metadata.summary ?? null,
  status: 'published',
  visibility: 'public',
  publishedVersion: document.metadata.version,
  draftVersion: document.metadata.version,
  language: document.metadata.language ?? 'pt-BR',
  updatedAt: new Date().toISOString(),
});

const sessionSummary = (entry: StoredSession) => ({
  id: entry.id,
  adventureId: ADVENTURE_ID,
  adventureTitle: document.metadata.title,
  adventureSlug: document.metadata.id,
  adventureVersion: entry.state.adventureVersion,
  characterName: entry.characterName,
  characterLevel: entry.state.character.level,
  status: entry.state.status,
  currentNodeId: entry.state.currentNodeId,
  sequence: entry.state.sequence,
  endingId: entry.state.endingId,
  playtimeSeconds: entry.playtimeSeconds,
  startedAt: entry.startedAt,
  updatedAt: entry.updatedAt,
});

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

/** Espelha o mapeamento da API real para que o cliente veja os mesmos codigos. */
const STATUS_BY_ENGINE_CODE: Record<string, number> = {
  ADVENTURE_INVALID: 422,
  DICE_EXPRESSION_INVALID: 422,
  NODE_NOT_FOUND: 404,
  CHOICE_NOT_FOUND: 404,
  ITEM_NOT_FOUND: 404,
  ENEMY_NOT_FOUND: 404,
  CHECKPOINT_NOT_FOUND: 404,
  SLOT_INVALID: 400,
  CHARACTER_INVALID: 400,
};

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolvePromise) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolvePromise(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch {
        resolvePromise({});
      }
    });
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function requireSession(id: string): StoredSession {
  const entry = sessions.get(id);
  if (!entry) {
    throw Object.assign(new Error('Partida nao encontrada.'), { httpStatus: 404 });
  }
  return entry;
}

function touch(
  entry: StoredSession,
  state: GameState,
  newEvents: StoredEvent[] = [],
): StoredSession {
  const now = new Date();
  const elapsed = Math.min(
    300,
    Math.max(0, Math.round((now.getTime() - new Date(entry.updatedAt).getTime()) / 1000)),
  );
  const updated: StoredSession = {
    ...entry,
    state,
    characterName: state.character.name,
    playtimeSeconds: entry.playtimeSeconds + elapsed,
    updatedAt: now.toISOString(),
    events: [...newEvents, ...entry.events].slice(0, MAX_STORED_EVENTS),
  };
  sessions.set(entry.id, updated);
  saveSessions();
  return updated;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method ?? 'GET';

  try {
    // ---------------------------------------------------------------- midia
    if (path.startsWith('/media/')) {
      const asset = (document.assets ?? []).find((entry) => entry.src === path);
      const svg = placeholderSvg(path, asset?.alt ?? asset?.id ?? 'Cena da aventura');
      res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(svg);
      return;
    }

    // ---------------------------------------------------------------- saude
    if (path === '/api/health' || path === '/api/health/ready') {
      return sendJson(res, 200, {
        status: 'ok',
        service: 'lonetale-preview-server',
        warning: 'Servidor de pre-visualizacao: sem banco de dados e sem autenticacao real.',
        adventure: `${document.metadata.title} v${document.metadata.version}`,
        sessions: sessions.size,
      });
    }

    // --------------------------------------------------------- autenticacao
    if (
      path === '/api/auth/login' ||
      path === '/api/auth/register' ||
      path === '/api/auth/refresh'
    ) {
      return sendJson(res, 200, sessionPayload());
    }
    if (path === '/api/auth/me') {
      return sendJson(res, 200, USER);
    }
    if (path === '/api/auth/logout' || path === '/api/auth/logout-all') {
      res.writeHead(204);
      return res.end();
    }

    // -------------------------------------------------------------- catalogo
    if (path === '/api/catalog') {
      return sendJson(res, 200, { total: 1, page: 1, pageSize: 20, items: [catalogEntry()] });
    }
    if (path.startsWith('/api/catalog/')) {
      const slug = decodeURIComponent(path.slice('/api/catalog/'.length));
      if (slug !== document.metadata.id) {
        return sendJson(res, 404, { statusCode: 404, message: 'Aventura nao encontrada.' });
      }
      return sendJson(res, 200, catalogDetail());
    }

    // --------------------------------------------------------------- Studio
    if (path === '/api/adventures/schema') {
      return sendJson(res, 200, ADVENTURE_JSON_SCHEMA);
    }
    if (path === '/api/adventures/validate' && method === 'POST') {
      const body = await readBody(req);
      return sendJson(res, 200, validateAdventure(body.document));
    }
    if (path === '/api/adventures' && method === 'GET') {
      return sendJson(res, 200, [adventureSummary()]);
    }
    if (path === `/api/adventures/${ADVENTURE_ID}`) {
      return sendJson(res, 200, {
        adventure: {
          ...adventureSummary(),
          currentVersionId: VERSION_ID,
          draftVersionId: VERSION_ID,
        },
        versions: [
          {
            id: VERSION_ID,
            version: document.metadata.version,
            schemaVersion: document.schemaVersion,
            status: 'draft',
            nodeCount: document.nodes.length,
            checksum: 'pre-visualizacao'.padEnd(64, '0'),
            releaseNotes: 'Documento lido do disco pelo servidor de pre-visualizacao.',
            publishedAt: null,
            createdAt: new Date().toISOString(),
          },
        ],
      });
    }
    if (path.includes('/versions/') && path.endsWith('/document')) {
      return sendJson(res, 200, document);
    }

    // -------------------------------------------------------------- partidas
    if (path === '/api/sessions' && method === 'GET') {
      const list = [...sessions.values()]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map(sessionSummary);
      return sendJson(res, 200, list);
    }

    if (path === '/api/sessions' && method === 'POST') {
      const body = await readBody(req);
      const draft = body.character as CharacterDraft | undefined;
      if (!draft) {
        return sendJson(res, 400, { statusCode: 400, message: 'Informe o personagem.' });
      }
      const seed = (url.searchParams.get('seed') ?? `preview-${randomUUID()}`).slice(0, 64);
      const step = engine.startGame(draft, { seed });
      const now = new Date().toISOString();
      const entry: StoredSession = {
        id: randomUUID(),
        state: step.state,
        characterName: step.state.character.name,
        startedAt: now,
        updatedAt: now,
        playtimeSeconds: 0,
        events: toStoredEvents(
          step.state.sequence,
          'startGame',
          step.state.currentNodeId,
          step.events,
        ).reverse(),
      };
      sessions.set(entry.id, entry);
      saveSessions();
      return sendJson(res, 200, { sessionId: entry.id, view: step.view, events: step.events });
    }

    const actionMatch = /^\/api\/sessions\/([^/]+)\/actions$/.exec(path);
    if (actionMatch && method === 'POST') {
      const entry = requireSession(actionMatch[1] as string);
      const action = (await readBody(req)) as unknown as PlayerAction;
      const step = engine.apply(entry.state, action);
      const updated = touch(
        entry,
        step.state,
        toStoredEvents(
          step.state.sequence,
          (action as { type?: string }).type ?? 'unknown',
          step.state.currentNodeId,
          step.events,
        ).reverse(),
      );
      return sendJson(res, 200, { sessionId: updated.id, view: step.view, events: step.events });
    }

    const eventsMatch = /^\/api\/sessions\/([^/]+)\/events$/.exec(path);
    if (eventsMatch) {
      const entry = requireSession(eventsMatch[1] as string);
      const limit = Math.min(
        MAX_STORED_EVENTS,
        Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '100', 10) || 100),
      );
      return sendJson(res, 200, entry.events.slice(0, limit));
    }

    const sessionMatch = /^\/api\/sessions\/([^/]+)$/.exec(path);
    if (sessionMatch && method === 'GET') {
      const entry = requireSession(sessionMatch[1] as string);
      return sendJson(res, 200, {
        sessionId: entry.id,
        view: engine.view(entry.state),
        events: [],
      });
    }
    if (sessionMatch && method === 'DELETE') {
      const entry = requireSession(sessionMatch[1] as string);
      touch(entry, { ...entry.state, status: 'abandoned' });
      res.writeHead(204);
      return res.end();
    }

    // ------------------------------------------------- utilidades de preview
    if (path === '/api/preview/reset' && method === 'POST') {
      sessions.clear();
      saveSessions();
      return sendJson(res, 200, { ok: true, message: 'Todas as partidas de pre-visualizacao foram apagadas.' });
    }

    return sendJson(res, 404, {
      statusCode: 404,
      message: `O servidor de pre-visualizacao nao implementa ${method} ${path}.`,
    });
  } catch (error) {
    if (error instanceof EngineError) {
      const status = STATUS_BY_ENGINE_CODE[error.code] ?? 409;
      return sendJson(res, status, {
        statusCode: status,
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      });
    }
    const status = (error as { httpStatus?: number }).httpStatus ?? 500;
    return sendJson(res, status, { statusCode: status, message: (error as Error).message });
  }
});

server.listen(PORT, () => {
  process.stdout.write(
    [
      '',
      '  LoneTale — servidor de PRE-VISUALIZACAO',
      '  ---------------------------------------',
      `  Aventura : ${document.metadata.title} v${document.metadata.version}`,
      `  Nos      : ${document.nodes.length}`,
      `  Arquivo  : ${ADVENTURE_PATH}`,
      `  Porta    : ${PORT}`,
      '',
      '  Motor real, dados em memoria. Sem SQL Server e sem autenticacao.',
      '  Nao use como referencia de comportamento de producao.',
      '',
    ].join('\n'),
  );
});
