import { useAuthStore, type AuthenticatedUser } from '../store/auth-store';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

export interface ApiErrorBody {
  statusCode?: number;
  code?: string;
  message?: string | string[];
  details?: unknown;
  currentSequence?: number;
}

/** Erro de API com o codigo estavel do backend preservado. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;
  readonly currentSequence?: number;

  constructor(status: number, body: ApiErrorBody) {
    const message = Array.isArray(body.message)
      ? body.message.join(' ')
      : (body.message ?? `Falha na requisicao (${status}).`);
    super(message);
    this.name = 'ApiError';
    this.status = status;
    if (body.code !== undefined) {
      this.code = body.code;
    }
    if (body.details !== undefined) {
      this.details = body.details;
    }
    if (body.currentSequence !== undefined) {
      this.currentSequence = body.currentSequence;
    }
  }

  /** `true` quando o estado do cliente ficou defasado e deve ser recarregado. */
  get isStaleState(): boolean {
    return this.code === 'SEQUENCE_MISMATCH' || this.code === 'ACTION_NOT_ALLOWED';
  }
}

export interface SessionResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: AuthenticatedUser;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Rotas publicas nao tentam renovar a sessao em caso de 401. */
  anonymous?: boolean;
  signal?: AbortSignal;
}

/**
 * Renovacao compartilhada.
 *
 * Varias requisicoes podem receber 401 ao mesmo tempo (a pagina de jogo carrega
 * estado, catalogo e perfil juntos). Guardamos a promessa em curso para que
 * apenas uma renovacao aconteca, e todas esperem por ela -- caso contrario a
 * rotacao de tokens revogaria a familia e derrubaria a sessao.
 */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshSession(): Promise<string | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) {
    return null;
  }

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        useAuthStore.getState().clear();
        return null;
      }

      const session = (await response.json()) as SessionResponse;
      useAuthStore.getState().setSession(session);
      return session.accessToken;
    } catch {
      useAuthStore.getState().clear();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function parseError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody = {};
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    body = { message: response.statusText };
  }
  return new ApiError(response.status, body);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, anonymous = false, signal } = options;

  const send = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (token && !anonymous) {
      headers.Authorization = `Bearer ${token}`;
    }
    return fetch(`${API_BASE}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
    });
  };

  let response = await send(useAuthStore.getState().accessToken);

  if (response.status === 401 && !anonymous) {
    const token = await refreshSession();
    if (!token) {
      throw await parseError(response);
    }
    response = await send(token);
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/** Restaura a sessao no arranque, trocando o token de renovacao por um de acesso. */
export async function restoreSession(): Promise<void> {
  const store = useAuthStore.getState();
  if (!store.refreshToken) {
    store.setRestoring(false);
    return;
  }
  await refreshSession();
  useAuthStore.getState().setRestoring(false);
}

export const api = {
  login: (email: string, password: string) =>
    apiRequest<SessionResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      anonymous: true,
    }),

  register: (email: string, displayName: string, password: string) =>
    apiRequest<SessionResponse>('/auth/register', {
      method: 'POST',
      body: { email, displayName, password },
      anonymous: true,
    }),

  googleUrl: () =>
    apiRequest<{ authorizationUrl: string; flowToken: string; expiresInSeconds: number }>(
      '/auth/google/url',
      { anonymous: true },
    ),

  googleCallback: (code: string, state: string, flowToken: string) =>
    apiRequest<SessionResponse>('/auth/google/callback', {
      method: 'POST',
      body: { code, state, flowToken },
      anonymous: true,
    }),

  logout: async () => {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (refreshToken) {
      await apiRequest<void>('/auth/logout', {
        method: 'POST',
        body: { refreshToken },
        anonymous: true,
      }).catch(() => undefined);
    }
    useAuthStore.getState().clear();
  },
};

export { API_BASE };
