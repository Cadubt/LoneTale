import { useEffect, useRef } from 'react';

import { IconChevronRight } from '../icons';
import { OrnateDivider, OrnateFrame } from '../ornate';
import { cx } from '../ui';

/**
 * Painel de uma secao da ficha, aberto sobre a tela.
 *
 * O trilho da esquerda e um indice compacto -- os sete itens cabem sem rolagem.
 * Abrir a secao ali dentro empurraria metade do menu para fora da tela, entao o
 * conteudo vem para cima da pagina, onde tem largura de sobra.
 *
 * Fecha com Esc, com clique fora e devolve o foco a quem abriu.
 */
export function SectionDialog({
  title,
  icon,
  onClose,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-night-950/75 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(event) => {
        if (!panel.current?.contains(event.target as Node)) {
          onClose();
        }
      }}
    >
      <OrnateFrame
        className={cx('my-auto w-full max-w-lg overflow-hidden animate-fade-up')}
      >
        <div ref={panel} className="rail" role="dialog" aria-modal="true" aria-label={title}>
          <div className="flex items-center gap-2.5 px-4 pt-4">
            {icon && <span className="shrink-0 text-bronze-300">{icon}</span>}
            <h2 className="mr-auto font-display text-lg text-parchment-50">{title}</h2>
            <button
              ref={closeButton}
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="tap grid w-11 place-items-center rounded-md text-parchment-300 hover:bg-night-700"
            >
              <IconChevronRight className="h-5 w-5 rotate-90" />
            </button>
          </div>

          <OrnateDivider tone="dark" className="px-4 py-2" />

          <div className="scrollbar-thin max-h-[70vh] overflow-y-auto px-4 pb-4">{children}</div>
        </div>
      </OrnateFrame>
    </div>
  );
}
