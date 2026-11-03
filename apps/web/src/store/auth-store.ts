import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: 'player' | 'author' | 'admin' | string;
  locale?: string;
}

interface AuthState {
  /**
   * O token de acesso vive apenas em memoria: nao e persistido, de modo que
   * um XSS nao consegue le-lo do armazenamento do navegador. Ele e curto e e
   * reemitido a partir do token de renovacao quando a aba recarrega.
   */
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthenticatedUser | null;
  /** `true` enquanto a sessao esta sendo restaurada no arranque. */
  restoring: boolean;

  setSession: (session: {
    accessToken: string;
    refreshToken: string;
    user: AuthenticatedUser;
  }) => void;
  setAccessToken: (accessToken: string) => void;
  setRestoring: (restoring: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      restoring: true,

      setSession: ({ accessToken, refreshToken, user }) =>
        set({ accessToken, refreshToken, user, restoring: false }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setRestoring: (restoring) => set({ restoring }),
      clear: () => set({ accessToken: null, refreshToken: null, user: null, restoring: false }),
    }),
    {
      name: 'lonetale.session',
      // Apenas o token de renovacao e o perfil atravessam recarregamentos.
      partialize: (state) => ({ refreshToken: state.refreshToken, user: state.user }),
    },
  ),
);

export const selectIsAuthenticated = (state: AuthState): boolean => Boolean(state.accessToken);

export const selectCanAuthor = (state: AuthState): boolean =>
  state.user?.role === 'author' || state.user?.role === 'admin';
