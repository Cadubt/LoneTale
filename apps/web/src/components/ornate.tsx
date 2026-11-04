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

/**
 * Vinheta decorativa: uma silhueta de ruinas ao pe do painel.
 *
 * Preenche o espaco que sobra nos trilhos sem competir com o conteudo --
 * fica em tom muito baixo, como uma marca d'agua impressa na pagina.
 */
export function DecorativeVignette({ className }: { className?: string }) {
  return (
    <div className={cx('pointer-events-none select-none overflow-hidden', className)} aria-hidden="true">
      <svg viewBox="0 0 320 120" className="h-full w-full" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="vignette-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
            <stop offset="60%" stopColor="currentColor" stopOpacity="0.5" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.85" />
          </linearGradient>
        </defs>
        <g fill="url(#vignette-fade)">
          {/* colinas ao fundo */}
          <path d="M0 120 L0 92 Q40 70 80 86 Q120 102 150 88 Q190 70 230 90 Q270 108 320 86 L320 120 Z" opacity="0.5" />
          {/* torres e muralha */}
          <path d="M96 120 V58 h8 v-9 h8 v9 h8 v-9 h8 v9 h8 v62 Z" />
          <path d="M136 120 V74 h40 v-8 h8 v8 h8 v46 Z" opacity="0.9" />
          <path d="M192 120 V50 h7 v-10 h7 v10 h7 v-10 h7 v10 h7 v70 Z" />
          <path d="M160 120 V96 q8 -14 16 0 v24 Z" opacity="0.6" />
          {/* arvores */}
          <path d="M44 120 V104 l-9 2 9 -16 9 16 -9 -2 Z" opacity="0.75" />
          <path d="M268 120 V106 l-8 2 8 -14 8 14 -8 -2 Z" opacity="0.65" />
        </g>
      </svg>
    </div>
  );
}

/**
 * Retrato do personagem a partir da ficha.
 *
 * Desenha uma silhueta com a cor de pele e de cabelo que o jogador escolheu na
 * criacao -- as cores vem do proprio documento da aventura, resolvidas pelo
 * motor. Nao e um retrato pintado, e nem finge ser: e um marcador honesto que
 * ao menos se parece com o personagem, enquanto a arte definitiva nao existe.
 */
export function CharacterAvatar({
  name,
  skin,
  hair,
  size = 'md',
  className,
}: {
  name: string;
  skin?: string | undefined;
  hair?: string | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dimensions = size === 'lg' ? 'h-[72px] w-[72px]' : size === 'md' ? 'h-12 w-12' : 'h-9 w-9';
  const skinColor = skin ?? '#c08a5c';
  const hairColor = hair ?? '#3a2a18';

  return (
    <span
      className={cx(
        'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full',
        'border-2 border-bronze-400 bg-night-800 shadow-gold',
        dimensions,
        className,
      )}
      role="img"
      aria-label={`Retrato de ${name}`}
    >
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <defs>
          <radialGradient id={`bg-${skinColor.replace('#', '')}`} cx="50%" cy="34%" r="72%">
            <stop offset="0%" stopColor="#3a2a1c" />
            <stop offset="100%" stopColor="#120d08" />
          </radialGradient>
        </defs>
        <rect width="64" height="64" fill={`url(#bg-${skinColor.replace('#', '')})`} />
        {/* ombros */}
        <path d="M8 64c0-13 10.7-19 24-19s24 6 24 19z" fill={skinColor} opacity="0.92" />
        <path d="M8 64c0-13 10.7-19 24-19s24 6 24 19z" fill="#000" opacity="0.18" />
        {/* pescoco e cabeca */}
        <rect x="27" y="33" width="10" height="11" rx="4" fill={skinColor} />
        <ellipse cx="32" cy="27" rx="13" ry="14.5" fill={skinColor} />
        {/* cabelo */}
        <path
          d="M19 25c0-9 6-14 13-14s13 5 13 14c0-4-3.5-6.5-7-7.2-3.2-.7-5.5.6-9 .2-3.2-.4-5.4 1.4-6.4 3.6-.6 1.2-.9 2.3-.9 3.4z"
          fill={hairColor}
        />
        <path d="M19 25c-.6 3.3-.3 6 .6 8.2-2.4-2.6-3-6-2.2-9.2z" fill={hairColor} opacity="0.85" />
        <path d="M45 25c.6 3.3.3 6-.6 8.2 2.4-2.6 3-6 2.2-9.2z" fill={hairColor} opacity="0.85" />
      </svg>
    </span>
  );
}

/** Retrato circular com aro de metal (iniciais ou imagem). */
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
