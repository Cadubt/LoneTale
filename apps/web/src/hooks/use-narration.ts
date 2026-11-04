import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useUiStore } from '../store/ui-store';

/**
 * Narracao por voz com os recursos do proprio navegador (Web Speech API).
 *
 * Tres detalhes guiaram a implementacao:
 *
 * 1. **A lista de vozes chega depois.** Em quase todos os navegadores
 *    `getVoices()` volta vazia na primeira chamada e so se preenche no evento
 *    `voiceschanged`, por isso ouvimos esse evento em vez de ler uma vez.
 * 2. **Textos longos sao cortados.** O Chrome interrompe a fala por volta de
 *    quinze segundos, entao o texto e quebrado em frases e enfileirado: cada
 *    trecho e curto o bastante para nao ser cortado, e parar no meio fica
 *    preciso.
 * 3. **Nem todo navegador tem a API.** Sem suporte, `supported` e falso e a
 *    interface simplesmente nao mostra os controles -- a leitura manual
 *    continua sendo o caminho, como o requisito pede.
 *
 * A abstracao existe para que trocar por um servico de sintese (Azure AI
 * Speech) ou por um audio narrado previamente nao mexa na interface: basta
 * outra implementacao com a mesma forma.
 */
export interface Narration {
  supported: boolean;
  speaking: boolean;
  paused: boolean;
  voices: SpeechSynthesisVoice[];
  voiceUri: string | null;
  rate: number;
  muted: boolean;
  speak: (text: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setRate: (rate: number) => void;
  setVoiceUri: (uri: string | null) => void;
  toggleMuted: () => void;
}

/** Quebra o texto em trechos curtos, preservando a pontuacao. */
function toChunks(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…:;])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .flatMap((sentence) =>
      // Frases muito longas ainda seriam cortadas: dividimos por vírgula.
      sentence.length <= 180 ? [sentence] : sentence.split(/(?<=,)\s+/),
    );
}

export function useNarration(): Narration {
  // Seletores separados de proposito: devolver um objeto novo a cada render
  // faria o zustand considerar o estado sempre alterado.
  const narration = useUiStore((state) => state.narration);
  const setNarration = useUiStore((state) => state.setNarration);

  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const queue = useRef<string[]>([]);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!supported) {
      return;
    }
    const load = () => {
      const available = window.speechSynthesis.getVoices();
      if (available.length > 0) {
        setVoices(available);
      }
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, [supported]);

  // Ao sair da tela, a voz nao pode continuar falando sozinha.
  useEffect(() => {
    if (!supported) {
      return;
    }
    return () => {
      cancelled.current = true;
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  /** Prefere a voz escolhida; senao, a primeira em portugues. */
  const pickVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (voices.length === 0) {
      return null;
    }
    if (narration.voiceUri) {
      const chosen = voices.find((voice) => voice.voiceURI === narration.voiceUri);
      if (chosen) {
        return chosen;
      }
    }
    return (
      voices.find((voice) => voice.lang?.toLowerCase().startsWith('pt-br')) ??
      voices.find((voice) => voice.lang?.toLowerCase().startsWith('pt')) ??
      voices[0] ??
      null
    );
  }, [voices, narration.voiceUri]);

  const speakNext = useCallback(() => {
    if (cancelled.current) {
      return;
    }
    const next = queue.current.shift();
    if (next === undefined) {
      setSpeaking(false);
      setPaused(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(next);
    const voice = pickVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'pt-BR';
    }
    utterance.rate = narration.rate;
    utterance.volume = narration.muted ? 0 : 1;
    utterance.onend = () => speakNext();
    utterance.onerror = () => speakNext();

    window.speechSynthesis.speak(utterance);
  }, [narration.rate, narration.muted, pickVoice]);

  const stop = useCallback(() => {
    if (!supported) {
      return;
    }
    cancelled.current = true;
    queue.current = [];
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) {
        return;
      }
      cancelled.current = true;
      window.speechSynthesis.cancel();
      cancelled.current = false;
      queue.current = toChunks(text);
      setSpeaking(true);
      setPaused(false);
      speakNext();
    },
    [supported, speakNext],
  );

  const pause = useCallback(() => {
    if (!supported) {
      return;
    }
    window.speechSynthesis.pause();
    setPaused(true);
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) {
      return;
    }
    window.speechSynthesis.resume();
    setPaused(false);
  }, [supported]);

  return useMemo(
    () => ({
      supported,
      speaking,
      paused,
      voices,
      voiceUri: narration.voiceUri,
      rate: narration.rate,
      muted: narration.muted,
      speak,
      pause,
      resume,
      stop,
      setRate: (rate: number) => setNarration({ rate }),
      setVoiceUri: (voiceUri: string | null) => setNarration({ voiceUri }),
      toggleMuted: () => setNarration({ muted: !narration.muted }),
    }),
    [
      supported,
      speaking,
      paused,
      voices,
      narration.voiceUri,
      narration.rate,
      narration.muted,
      speak,
      pause,
      resume,
      stop,
      setNarration,
    ],
  );
}
