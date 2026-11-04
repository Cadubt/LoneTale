import { useEffect, useRef, useState } from 'react';

import type { Narration } from '../../hooks/use-narration';
import {
  IconChevronDown,
  IconGear,
  IconPause,
  IconPlay,
  IconSpeaker,
  IconSpeakerOff,
  IconStop,
} from '../icons';
import { cx } from '../ui';

const RATES = [0.75, 1, 1.25, 1.5, 2];

/**
 * Controles de narracao sobrepostos a imagem da cena.
 *
 * Some por completo quando o navegador nao oferece sintese de voz -- nesse
 * caso a leitura e manual, e um botao morto so atrapalharia.
 */
export function NarrationBar({
  narration,
  text,
  className,
}: {
  narration: Narration;
  text: string;
  className?: string;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }
    const close = (event: MouseEvent) => {
      if (container.current && !container.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [settingsOpen]);

  if (!narration.supported) {
    return null;
  }

  const playing = narration.speaking && !narration.paused;

  return (
    <div ref={container} className={cx('relative flex items-center gap-1.5', className)}>
      <div className="flex items-center gap-1 rounded-lg border border-bronze-400 bg-night-900/85 p-1 shadow-panel backdrop-blur">
        <button
          type="button"
          onClick={() => {
            if (!narration.speaking) {
              narration.speak(text);
            } else if (narration.paused) {
              narration.resume();
            } else {
              narration.pause();
            }
          }}
          className="tap flex items-center gap-2 rounded-md px-3 font-display text-sm text-gold-300 hover:bg-night-700"
          aria-label={playing ? 'Pausar narração' : narration.paused ? 'Continuar narração' : 'Narrar'}
        >
          {playing ? <IconPause className="h-5 w-5" /> : <IconPlay className="h-5 w-5" />}
          <span className="hidden sm:inline">
            {playing ? 'Pausar' : narration.paused ? 'Continuar' : 'Narrar'}
          </span>
        </button>

        {narration.speaking && (
          <button
            type="button"
            onClick={narration.stop}
            className="tap grid w-10 place-items-center rounded-md text-parchment-200 hover:bg-night-700"
            aria-label="Parar narração"
          >
            <IconStop className="h-4 w-4" />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={narration.toggleMuted}
        className="tap grid w-11 place-items-center rounded-lg border border-bronze-400 bg-night-900/85 text-parchment-200 shadow-panel backdrop-blur hover:bg-night-700"
        aria-label={narration.muted ? 'Reativar som' : 'Silenciar'}
        aria-pressed={narration.muted}
      >
        {narration.muted ? <IconSpeakerOff className="h-5 w-5" /> : <IconSpeaker className="h-5 w-5" />}
      </button>

      <button
        type="button"
        onClick={() => {
          const index = RATES.indexOf(narration.rate);
          narration.setRate(RATES[(index + 1) % RATES.length] as number);
        }}
        className="tap rounded-lg border border-bronze-400 bg-night-900/85 px-3 font-sans text-sm tabular-nums text-parchment-100 shadow-panel backdrop-blur hover:bg-night-700"
        aria-label={`Velocidade da narração: ${narration.rate.toFixed(2).replace('.', ',')} vezes`}
      >
        {narration.rate.toFixed(1).replace('.', ',')}×
      </button>

      <button
        type="button"
        onClick={() => setSettingsOpen((value) => !value)}
        aria-expanded={settingsOpen}
        className="tap grid w-11 place-items-center rounded-lg border border-bronze-400 bg-night-900/85 text-parchment-200 shadow-panel backdrop-blur hover:bg-night-700"
        aria-label="Opções de narração"
      >
        <IconGear className="h-5 w-5" />
      </button>

      {settingsOpen && (
        <div className="rail edge-bronze absolute bottom-full right-0 z-30 mb-2 w-64 rounded-lg p-3">
          <label
            htmlFor="narration-voice"
            className="mb-1 block font-sans text-[11px] uppercase tracking-wide text-bronze-300"
          >
            Voz
          </label>
          <div className="relative">
            <select
              id="narration-voice"
              value={narration.voiceUri ?? ''}
              onChange={(event) => narration.setVoiceUri(event.target.value || null)}
              className="tap w-full appearance-none rounded-md border border-bronze-500 bg-night-900 px-2 pr-8 font-sans text-sm text-parchment-100"
            >
              <option value="">Padrão do sistema (pt-BR)</option>
              {narration.voices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
            <IconChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-bronze-300" />
          </div>

          <label
            htmlFor="narration-rate"
            className="mb-1 mt-3 block font-sans text-[11px] uppercase tracking-wide text-bronze-300"
          >
            Velocidade: {narration.rate.toFixed(2).replace('.', ',')}×
          </label>
          <input
            id="narration-rate"
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={narration.rate}
            onChange={(event) => narration.setRate(Number(event.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-night-950 accent-gold-400"
          />

          {narration.voices.length === 0 && (
            <p className="mt-2 font-sans text-[11px] text-parchment-400">
              Nenhuma voz instalada foi encontrada. O navegador usará a voz padrão do sistema.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
