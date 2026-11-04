import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Estado de interface que nao pertence ao servidor.
 *
 * Duas coisas moram aqui: os avisos que a tela de jogo publica para o sino da
 * barra superior, e as preferencias de narracao, que o jogador espera reencontrar
 * na proxima sessao.
 */
interface UiState {
  /** Pontos de atributo esperando distribuicao na partida aberta. */
  pendingAttributePoints: number;
  setPendingAttributePoints: (value: number) => void;

  narration: {
    autoPlay: boolean;
    rate: number;
    voiceUri: string | null;
    muted: boolean;
  };
  setNarration: (patch: Partial<UiState['narration']>) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      pendingAttributePoints: 0,
      setPendingAttributePoints: (value) =>
        set((state) =>
          state.pendingAttributePoints === value ? state : { pendingAttributePoints: value },
        ),

      narration: { autoPlay: false, rate: 1, voiceUri: null, muted: false },
      setNarration: (patch) =>
        set((state) => ({ narration: { ...state.narration, ...patch } })),
    }),
    {
      name: 'lonetale.ui',
      // Avisos sao do momento: so as preferencias atravessam recarregamentos.
      partialize: (state) => ({ narration: state.narration }),
    },
  ),
);
