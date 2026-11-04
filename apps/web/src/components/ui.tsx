import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// ------------------------------------------------------------------ botoes
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'parchment';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gold-choice text-sepia-900 border border-bronze-400 font-semibold shadow-gold hover:brightness-105 active:brightness-95',
  secondary:
    'bg-night-700 text-parchment-100 border border-bronze-500 hover:bg-night-600 active:bg-night-800',
  ghost: 'text-parchment-200 hover:bg-night-700/70 border border-transparent',
  danger:
    'bg-blood-600 text-parchment-50 border border-blood-700 font-semibold hover:bg-blood-500 active:bg-blood-700',
  parchment:
    'bg-parchment-200 text-sepia-800 border border-bronze-400 hover:bg-parchment-100 active:bg-parchment-300',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-[36px] px-3 text-sm',
  md: 'tap px-4 text-[0.95rem]',
  lg: 'min-h-[52px] px-6 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  block = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md transition-all',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ paineis
export function Panel({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div {...rest} className={cx('rail edge-bronze rounded-lg p-4 sm:p-5', className)}>
      {children}
    </div>
  );
}

export function PanelTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-sm uppercase tracking-[0.16em] text-bronze-300">
        {children}
      </h2>
      {hint && <span className="font-sans text-xs text-parchment-400">{hint}</span>}
    </div>
  );
}

// ------------------------------------------------------------------ selos
type BadgeTone = 'neutral' | 'gold' | 'arcane' | 'blood' | 'moss' | 'parchment';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-night-700 text-parchment-200 border-bronze-600',
  gold: 'bg-gold-500/20 text-gold-300 border-gold-500/55',
  arcane: 'bg-arcane-600/25 text-arcane-300 border-arcane-600/55',
  blood: 'bg-blood-600/25 text-blood-400 border-blood-600/55',
  moss: 'bg-moss-600/25 text-moss-400 border-moss-600/55',
  parchment: 'bg-parchment-300/70 text-sepia-800 border-bronze-400',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-sans text-[11px] font-medium uppercase tracking-wide',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ------------------------------------------------------------------ barras
/** Barra de recurso (vida, mana). Acessivel como progressbar. */
export function Meter({
  label,
  icon,
  current,
  max,
  color,
  compact = false,
  inline = false,
}: {
  label: string;
  icon?: ReactNode;
  current: number;
  max: number;
  color?: string;
  compact?: boolean;
  inline?: boolean;
}) {
  const safeMax = Math.max(1, max);
  const ratio = Math.max(0, Math.min(1, current / safeMax));
  const critical = ratio <= 0.25;

  return (
    <div className={cx(inline && 'flex items-center gap-2')}>
      <div
        className={cx(
          'flex items-baseline justify-between gap-2 font-sans text-xs',
          inline ? 'shrink-0' : 'mb-1',
        )}
      >
        <span className={cx('flex items-center gap-1.5', critical ? 'text-blood-400' : 'text-parchment-300')}>
          {icon}
          {!inline && label}
        </span>
        {!inline && (
          <span className="tabular-nums text-parchment-200">
            {Math.round(current)} / {Math.round(safeMax)}
          </span>
        )}
      </div>

      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(current)}
        aria-valuemin={0}
        aria-valuemax={Math.round(safeMax)}
        className={cx(
          'overflow-hidden rounded-full border border-black/40 bg-night-950 shadow-inset',
          inline ? 'h-2 flex-1' : compact ? 'h-1.5' : 'h-2.5',
        )}
      >
        <div
          className={cx(
            'h-full rounded-full transition-[width] duration-500',
            critical && 'animate-pulse-soft',
          )}
          style={{
            width: `${ratio * 100}%`,
            background: color
              ? `linear-gradient(180deg, ${color} 0%, ${color} 55%, rgba(0,0,0,0.25) 100%)`
              : 'linear-gradient(180deg,#e06b5f 0%,#c0392b 55%,#7b241c 100%)',
          }}
        />
      </div>

      {inline && (
        <span className="shrink-0 font-sans text-xs tabular-nums text-parchment-200">
          {Math.round(current)} / {Math.round(safeMax)}
        </span>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ estados
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cx('animate-spin text-current', className ?? 'h-5 w-5')}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function LoadingBlock({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-parchment-300" role="status">
      <Spinner />
      <span className="font-sans text-sm">{label}</span>
    </div>
  );
}

export function ErrorNotice({
  title = 'Algo deu errado',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-lg border border-blood-600/50 bg-blood-700/15 p-4">
      <h2 className="font-display text-base text-blood-400">{title}</h2>
      <p className="mt-1 font-sans text-sm text-parchment-200">{message}</p>
      {onRetry && (
        <Button className="mt-3" size="sm" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rail edge-bronze rounded-lg px-6 py-12 text-center">
      <h2 className="font-display text-lg text-parchment-100">{title}</h2>
      <p className="mx-auto mt-2 max-w-md font-sans text-sm text-parchment-300">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/** Paragrafos a partir de texto com linhas em branco, em tinta sobre pergaminho. */
export function Narrative({ text, className }: { text: string; className?: string }) {
  const paragraphs = text.split(/\n{2,}/).filter((part) => part.trim().length > 0);
  return (
    <div className={cx('narrative', className)}>
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}
