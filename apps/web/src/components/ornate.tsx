import type { ReactNode } from 'react';

import { cx } from './ui';

/**
 * Molduras e ornamentos.
 *
 * A moldura e feita de CSS e quatro pequenos losangos nos cantos, nao de
 * imagens: escala em qualquer tamanho, acompanha o tema e nao custa requisicao.
 */

function CornerDiamonds({ tone = 'bronze' }: { tone?: 'bronze' | 'gold' }) {
  const color = tone === 'gold' ? 'bg-gold-400' : 'bg-bronze-400';
  const positions = [
    '-left-[3px] -top-[3px]',
    '-right-[3px] -top-[3px]',
    '-bottom-[3px] -left-[3px]',
    '-bottom-[3px] -right-[3px]',
  ];
  return (
    <>
      {positions.map((position) => (
        <span
          key={position}
          aria-hidden="true"
          className={cx(
            'pointer-events-none absolute h-[7px] w-[7px] rotate-45 border border-black/40',
            color,
            position,
          )}
        />
      ))}
    </>
  );
}

/** Caixa com borda de metal e losangos nos cantos. */
export function OrnateFrame({
  children,
  className,
  tone = 'bronze',
  corners = true,
}: {
  children: ReactNode;
  className?: string;
  tone?: 'bronze' | 'gold';
  corners?: boolean;
}) {
  return (
    <div
      className={cx(
        'relative rounded-lg border',
        tone === 'gold' ? 'border-gold-500' : 'border-bronze-500',
        'shadow-panel',
        className,
      )}
    >
      {corners && <CornerDiamonds tone={tone} />}
      {children}
    </div>
  );
}

/** Painel de pergaminho: onde o texto longo e lido. */
export function ParchmentPanel({
  children,
  className,
  bodyClassName,
}: {
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <OrnateFrame className={cx('overflow-hidden', className)}>
      <div className={cx('parchment', bodyClassName ?? 'p-4 sm:p-6')}>{children}</div>
    </OrnateFrame>
  );
}

/** Painel escuro dos trilhos laterais e das barras. */
export function RailPanel({
  children,
  className,
  bodyClassName,
}: {
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <OrnateFrame className={cx('overflow-hidden', className)}>
      <div className={cx('rail', bodyClassName ?? 'p-4')}>{children}</div>
    </OrnateFrame>
  );
}

/** Cabecalho de secao com icone, no tom do pergaminho ou do trilho. */
export function SectionHeading({
  icon,
  children,
  action,
  tone = 'dark',
}: {
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  tone?: 'dark' | 'parchment';
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon && (
        <span className={cx('shrink-0', tone === 'parchment' ? 'text-sepia-600' : 'text-bronze-300')}>
          {icon}
        </span>
      )}
      <h2
        className={cx(
          'mr-auto font-display text-[0.95rem] tracking-wide',
          tone === 'parchment' ? 'text-sepia-800' : 'text-parchment-100',
        )}
      >
        {children}
      </h2>
      {action}
    </div>
  );
}

/** Divisor com losango central, como nas paginas dos livros antigos. */
export function OrnateDivider({
  className,
  tone = 'parchment',
}: {
  className?: string;
  tone?: 'parchment' | 'dark';
}) {
  const line = tone === 'parchment' ? 'bg-bronze-400/45' : 'bg-bronze-500/45';
  const diamond = tone === 'parchment' ? 'bg-bronze-400/70' : 'bg-bronze-400/60';
  return (
    <div className={cx('flex items-center gap-2', className)} aria-hidden="true">
      <span className={cx('h-px flex-1', line)} />
      <span className={cx('h-1 w-1 rotate-45', diamond)} />
      <span className={cx('h-1.5 w-1.5 rotate-45', diamond)} />
      <span className={cx('h-1 w-1 rotate-45', diamond)} />
      <span className={cx('h-px flex-1', line)} />
    </div>
  );
}

/** Retrato circular com aro de metal. */
export function Portrait({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dimensions = size === 'lg' ? 'h-20 w-20' : size === 'md' ? 'h-12 w-12' : 'h-9 w-9';
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <span
      className={cx(
        'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full',
        'border-2 border-bronze-400 bg-night-700 shadow-gold',
        dimensions,
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="font-display text-bronze-200" aria-hidden="true">
          {initials || '?'}
        </span>
      )}
    </span>
  );
}
