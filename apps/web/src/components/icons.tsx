import type { SVGProps } from 'react';

/**
 * Conjunto de icones da interface.
 *
 * Desenhados a mao em SVG, com o mesmo tracado (24x24, stroke 1.7), em vez de
 * uma biblioteca: sao poucos, precisam combinar com a moldura de bronze e
 * evitam somar centenas de KB ao pacote por causa de duas dezenas de glifos.
 */
type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Svg({ title, children, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...rest}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

// --------------------------------------------------------------- navegacao
export const IconHome = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9.5V20h13V9.5" />
    <path d="M10 20v-5h4v5" />
  </Svg>
);

export const IconBook = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5z" />
    <path d="M4 19.5A1.5 1.5 0 0 1 5.5 18H19v3H5.5A1.5 1.5 0 0 1 4 19.5z" />
    <path d="M8 7h7M8 10.5h7" />
  </Svg>
);

export const IconUsers = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
    <path d="M16 6.3a3 3 0 0 1 0 5.4" />
    <path d="M17.5 14.4c2 .7 3.5 2.4 3.5 4.6" />
  </Svg>
);

export const IconGamepad = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7.5 7h9a4.5 4.5 0 0 1 4.4 5.4l-.8 4A3 3 0 0 1 15.4 18l-1.3-2h-4.2l-1.3 2a3 3 0 0 1-4.7-1.6l-.8-4A4.5 4.5 0 0 1 7.5 7z" />
    <path d="M8 11h2.5M9.25 9.75v2.5" />
    <circle cx="15.5" cy="10.5" r=".9" fill="currentColor" stroke="none" />
    <circle cx="17.3" cy="12.6" r=".9" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconSwords = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4h3l9.5 9.5" />
    <path d="M20 4h-3L7.5 13.5" />
    <path d="M5.5 15 9 18.5l-2 2L3.5 17z" />
    <path d="M18.5 15 15 18.5l2 2 3.5-3.5z" />
  </Svg>
);

export const IconBell = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6z" />
    <path d="M10.3 19a2 2 0 0 0 3.4 0" />
  </Svg>
);

export const IconMenu = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);

export const IconArrowLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 12H5" />
    <path d="m11 6-6 6 6 6" />
  </Svg>
);

// -------------------------------------------------------------- personagem
export const IconHeart = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M12 20s-7-4.3-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.8C19 15.7 12 20 12 20z"
      fill="currentColor"
      stroke="none"
    />
  </Svg>
);

export const IconDroplet = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3s5.5 6 5.5 9.8A5.5 5.5 0 0 1 6.5 12.8C6.5 9 12 3 12 3z" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconCoins = (p: IconProps) => (
  <Svg {...p}>
    <ellipse cx="12" cy="7" rx="7" ry="3" />
    <path d="M5 7v4c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
    <path d="M5 11v4c0 1.7 3.1 3 7 3s7-1.3 7-3v-4" />
  </Svg>
);

export const IconBackpack = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9a6 6 0 0 1 12 0v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" />
    <path d="M9.5 9V6.5a2.5 2.5 0 0 1 5 0V9" />
    <path d="M9 14h6v3H9z" />
  </Svg>
);

export const IconShield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 5 6v5.5c0 4.3 3 7.6 7 9.5 4-1.9 7-5.2 7-9.5V6z" />
  </Svg>
);

export const IconBars = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 20V12M12 20V5M19 20v-5" />
  </Svg>
);

export const IconSparkles = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 13.6 9l5.4 1.6-5.4 1.7L12 17.5l-1.6-5.2L5 10.6 10.4 9z" />
    <path d="M18.5 16.5 19.2 18.7 21.5 19.4 19.2 20.1 18.5 22.3 17.8 20.1 15.5 19.4 17.8 18.7z" />
  </Svg>
);

export const IconScroll = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6" />
    <path d="M6 4a2 2 0 0 0-2 2v2h4" />
    <path d="M18 20a2 2 0 0 0 2-2v-2h-4" />
    <path d="M9 9.5h6M9 13h6" />
  </Svg>
);

export const IconClock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

// ----------------------------------------------------------------- estado
export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Svg>
);

export const IconLock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
    <path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" />
  </Svg>
);

export const IconAlert = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.3v.2" />
  </Svg>
);

export const IconRope = (p: IconProps) => (
  <Svg {...p}>
    <ellipse cx="12" cy="12" rx="8" ry="5.5" />
    <ellipse cx="12" cy="12" rx="4.5" ry="2.8" />
    <path d="M4.3 10.4c1.4.9 3 1.4 4.3 1.2M19.7 13.6c-1.4-.9-3-1.4-4.3-1.2" />
  </Svg>
);

// --------------------------------------------------------------- historico
export const IconCart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 4h2l2.2 9.4A2 2 0 0 0 9.1 15h7.6a2 2 0 0 0 1.9-1.4L20 8H6" />
    <circle cx="9.5" cy="19" r="1.4" />
    <circle cx="17" cy="19" r="1.4" />
  </Svg>
);

export const IconChat = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 12.5c0 3.6-3.6 6.5-8 6.5a9.6 9.6 0 0 1-2.6-.35L5 20.5l1.1-3.1A6.9 6.9 0 0 1 4 12.5C4 8.9 7.6 6 12 6s8 2.9 8 6.5z" />
  </Svg>
);

export const IconFootsteps = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7.5 4.5c1.4 0 2.2 1.3 2 3-.2 1.6-.6 2.5-2 2.5s-2.2-1-2-2.6c.2-1.7.6-2.9 2-2.9z" />
    <path d="M5.8 11.5h3.4l-.3 3.2a1.4 1.4 0 0 1-2.8 0z" />
    <path d="M16.5 9.5c1.4 0 2.2 1.3 2 3-.2 1.6-.6 2.5-2 2.5s-2.2-1-2-2.6c.2-1.7.6-2.9 2-2.9z" />
    <path d="M14.8 16.5h3.4l-.3 3.2a1.4 1.4 0 0 1-2.8 0z" />
  </Svg>
);

export const IconDice = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <circle cx="9" cy="9" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconFlag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 21V4" />
    <path d="M6 4.5h10.5l-1.8 3.5 1.8 3.5H6" />
  </Svg>
);

export const IconSkull = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3c-4.4 0-7.5 3-7.5 7 0 2.4 1.2 4 2.5 5v2.5A1.5 1.5 0 0 0 8.5 19h7a1.5 1.5 0 0 0 1.5-1.5V15c1.3-1 2.5-2.6 2.5-5 0-4-3.1-7-7.5-7z" />
    <circle cx="9.3" cy="11" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="14.7" cy="11" r="1.4" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconStar = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 4 2.3 4.9 5.2.7-3.8 3.6 1 5.2L12 16l-4.7 2.4 1-5.2-3.8-3.6 5.2-.7z" />
  </Svg>
);

// ---------------------------------------------------------------- narracao
export const IconPlay = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconPause = (p: IconProps) => (
  <Svg {...p}>
    <rect x="7" y="5.5" width="3.6" height="13" rx="1" fill="currentColor" stroke="none" />
    <rect x="13.4" y="5.5" width="3.6" height="13" rx="1" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconStop = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconSpeaker = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" />
    <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
    <path d="M18 7a7.5 7.5 0 0 1 0 10" />
  </Svg>
);

export const IconSpeakerOff = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" />
    <path d="m16 10 4 4M20 10l-4 4" />
  </Svg>
);

export const IconGear = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8v2.4M12 18.8v2.4M4.5 7.5l2 1.2M17.5 15.3l2 1.2M4.5 16.5l2-1.2M17.5 8.7l2-1.2" />
  </Svg>
);

/** Resolve o nome declarado em `choice.icon` para um componente. */
export const CHOICE_ICONS: Record<string, (p: IconProps) => JSX.Element> = {
  rope: IconRope,
  corda: IconRope,
  sparkles: IconSparkles,
  levitacao: IconSparkles,
  swords: IconSwords,
  combate: IconSwords,
  back: IconArrowLeft,
  voltar: IconArrowLeft,
  bridge: IconFlag,
  book: IconBook,
  star: IconStar,
  cart: IconCart,
  chat: IconChat,
  scroll: IconScroll,
};
