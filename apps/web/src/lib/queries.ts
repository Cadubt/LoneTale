import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import type { GameEvent, NodeView, PlayerActionType } from '@lonetale/engine';

import { ApiError, apiRequest } from './api-client';

// ---------------------------------------------------------------- contratos
export interface CatalogEntry {
  adventureId: string;
  slug: string;
  title: string;
  summary: string | null;
  version: string;
  estimatedMinutes?: number;
  difficulty?: string;
  genre: string[];
  coverImageSrc: string | null;
  publishedAt: string | null;
}

export interface Paginated<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}

export interface AttributeDefinitionView {
  id: string;
  name: string;
  abbreviation?: string;
  description?: string;
  min: number;
  max: number;
  default: number;
}

export interface AppearanceFieldView {
  id: string;
  label: string;
  kind: 'select' | 'color' | 'text' | 'number';
  options?: Array<{ id: string; label: string; color?: string }>;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  required?: boolean;
  default?: string | number | boolean | null;
  maxLength?: number;
}

export interface CharacterCreationOptionsView {
  startNodeId: string;
  intro?: string;
  name: { required: boolean; minLength: number; maxLength: number; suggestions: string[] };
  classes: Array<{
    id: string;
    name: string;
    description?: string;
    allowedRaceIds: string[] | null;
  }>;
  races: Array<{
    id: string;
    name: string;
    description?: string;
    allowedClassIds: string[] | null;
    appearanceRestrictions: Record<string, string[]> | null;
  }>;
  attributes: {
    method: 'pointBuy' | 'fixed' | 'roll';
    points: number;
    minPerAttribute: number;
    maxPerAttribute: number;
    rollDice?: string;
    definitions: AttributeDefinitionView[];
  };
  appearanceFields: AppearanceFieldView[];
  allowDescription: boolean;
  descriptionMaxLength: number;
  startingGold: number;
}

export interface AdventureDetail extends CatalogEntry {
  adventureVersionId: string;
  description: string | null;
  world: string | null;
  tags: string[];
  contentWarnings: string[];
  ageRating: string | null;
  ruleset: {
    id: string;
    name: string;
    description: string | null;
    combatEnabled: boolean;
    progressionEnabled: boolean;
  };
  characterCreation: CharacterCreationOptionsView;
}

export interface SessionSummary {
  id: string;
  adventureId: string;
  adventureTitle: string;
  adventureSlug: string;
  adventureVersion: string;
  characterName: string;
  characterLevel: number;
  status: string;
  currentNodeId: string;
  sequence: number;
  endingId: string | null;
  playtimeSeconds: number;
  startedAt: string;
  updatedAt: string;
}

export interface SessionState {
  sessionId: string;
  view: NodeView;
  events: GameEvent[];
  replayed?: boolean;
}

export interface CharacterDraftInput {
  name: string;
  classId?: string;
  raceId?: string;
  attributes?: Record<string, number>;
  appearance?: Record<string, string | number | boolean | null>;
  description?: string;
}

export interface PlayerActionInput {
  type: PlayerActionType;
  expectedSequence: number;
  idempotencyKey?: string;
  nodeId?: string;
  choiceId?: string;
  itemId?: string;
  skillId?: string;
  attributeId?: string;
  targetInstanceId?: string;
  slot?: string;
  quantity?: number;
  points?: number;
}

export interface AdventureSummary {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  status: string;
  visibility: string;
  publishedVersion: string | null;
  draftVersion: string | null;
  language: string;
  updatedAt: string;
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

// ------------------------------------------------------------------- chaves
export const queryKeys = {
  catalog: (search: string, genre: string) => ['catalog', search, genre] as const,
  adventure: (slug: string) => ['catalog', 'detail', slug] as const,
  sessions: () => ['sessions'] as const,
  session: (id: string) => ['sessions', id] as const,
  sessionEvents: (id: string) => ['sessions', id, 'events'] as const,
  studioAdventures: () => ['studio', 'adventures'] as const,
  studioAdventure: (id: string) => ['studio', 'adventures', id] as const,
  studioDocument: (id: string, versionId: string) =>
    ['studio', 'adventures', id, versionId, 'document'] as const,
};

// -------------------------------------------------------------- jogador
export function useCatalog(search: string, genre: string) {
  return useQuery({
    queryKey: queryKeys.catalog(search, genre),
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) {
        params.set('search', search);
      }
      if (genre) {
        params.set('genre', genre);
      }
      const query = params.toString();
      return apiRequest<Paginated<CatalogEntry>>(`/catalog${query ? `?${query}` : ''}`, {
        anonymous: true,
      });
    },
    staleTime: 60_000,
  });
}

export function useAdventureDetail(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.adventure(slug ?? ''),
    queryFn: () => apiRequest<AdventureDetail>(`/catalog/${slug}`, { anonymous: true }),
    enabled: Boolean(slug),
    staleTime: 60_000,
  });
}

export function useSessions(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.sessions(),
    queryFn: () => apiRequest<SessionSummary[]>('/sessions'),
    enabled: options.enabled ?? true,
  });
}

export interface PersistedEvent {
  id: string;
  sequence: number;
  ordinal: number;
  kind: string;
  nodeId: string | null;
  actionType: string | null;
  payload: string;
  createdAt: string;
}

/**
 * Historico persistido da partida.
 *
 * O painel "Historico" precisa sobreviver a um recarregamento da pagina, e o
 * estado projetado so carrega os eventos do ultimo passo. Este e o log gravado
 * no servidor.
 */
export function useSessionEvents(sessionId: string | undefined, limit = 60) {
  return useQuery({
    queryKey: queryKeys.sessionEvents(sessionId ?? ''),
    queryFn: () =>
      apiRequest<PersistedEvent[]>(`/sessions/${sessionId}/events?limit=${limit}`),
    enabled: Boolean(sessionId),
    staleTime: 0,
  });
}

export function useSessionState(sessionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.session(sessionId ?? ''),
    queryFn: () => apiRequest<SessionState>(`/sessions/${sessionId}`),
    enabled: Boolean(sessionId),
    // O estado so muda por acao do jogador: nada a ganhar com refetch automatico.
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });
}

export function useStartSession(): UseMutationResult<
  SessionState,
  ApiError,
  { adventure: string; character: CharacterDraftInput }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input) =>
      apiRequest<SessionState>('/sessions', { method: 'POST', body: input }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.session(data.sessionId), data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions() });
    },
  });
}

/**
 * Envia uma acao do jogador.
 *
 * Gera uma chave de idempotencia por tentativa: se a resposta se perder na
 * rede e o jogador repetir, o backend devolve o resultado original em vez de
 * aplicar a acao (e a recompensa) de novo.
 */
export function useSessionAction(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation<SessionState, ApiError, PlayerActionInput>({
    mutationFn: (action) =>
      apiRequest<SessionState>(`/sessions/${sessionId}/actions`, {
        method: 'POST',
        body: {
          ...action,
          idempotencyKey: action.idempotencyKey ?? crypto.randomUUID(),
        },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.session(sessionId), data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessionEvents(sessionId) });
    },
    onError: (error) => {
      // Estado defasado: recarrega a verdade do servidor em vez de insistir.
      if (error.isStaleState) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.session(sessionId) });
      }
    },
  });
}

export function useAbandonSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiRequest<void>(`/sessions/${sessionId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions() });
    },
  });
}

// --------------------------------------------------------------- studio
export function useStudioAdventures() {
  return useQuery({
    queryKey: queryKeys.studioAdventures(),
    queryFn: () => apiRequest<AdventureSummary[]>('/adventures'),
  });
}

export function useStudioAdventure(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.studioAdventure(id ?? ''),
    queryFn: () =>
      apiRequest<{
        adventure: AdventureSummary & { currentVersionId: string | null; draftVersionId: string | null };
        versions: Array<{
          id: string;
          version: string;
          schemaVersion: string;
          status: string;
          nodeCount: number;
          checksum: string;
          releaseNotes: string | null;
          publishedAt: string | null;
          createdAt: string;
        }>;
      }>(`/adventures/${id}`),
    enabled: Boolean(id),
  });
}

export function useStudioDocument(adventureId: string | undefined, versionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.studioDocument(adventureId ?? '', versionId ?? ''),
    queryFn: () =>
      apiRequest<Record<string, unknown>>(
        `/adventures/${adventureId}/versions/${versionId}/document`,
      ),
    enabled: Boolean(adventureId && versionId),
  });
}

export function useValidateDocument() {
  return useMutation<ValidationResult, ApiError, Record<string, unknown>>({
    mutationFn: (document) =>
      apiRequest<ValidationResult>('/adventures/validate', {
        method: 'POST',
        body: { document },
        anonymous: true,
      }),
  });
}

export function useImportAdventure() {
  const queryClient = useQueryClient();
  return useMutation<
    { adventureId: string; slug: string; version: string; published: boolean },
    ApiError,
    { document: Record<string, unknown>; publish?: boolean; visibility?: string }
  >({
    mutationFn: (input) => apiRequest('/adventures', { method: 'POST', body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.studioAdventures() });
    },
  });
}

export function useSaveDraft(adventureId: string) {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, { document: Record<string, unknown>; releaseNotes?: string }>(
    {
      mutationFn: (input) =>
        apiRequest(`/adventures/${adventureId}/draft`, { method: 'PUT', body: input }),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.studioAdventure(adventureId) });
      },
    },
  );
}

export function usePublishAdventure(adventureId: string) {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, { visibility: string; releaseNotes?: string }>({
    mutationFn: (input) =>
      apiRequest(`/adventures/${adventureId}/publish`, { method: 'POST', body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.studioAdventure(adventureId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.studioAdventures() });
    },
  });
}
