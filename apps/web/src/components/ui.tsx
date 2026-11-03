import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-ember-500 text-ink-950 hover:bg-ember-400 active:bg-ember-600 shadow-glow font-semibold',
  secondary:
    'bg-ink-800/80 text-ink-100 border border-ink-700 hover:bg-ink-700/80 active:bg-ink-800',
  ghost: 'text-ink-200 hover:bg-ink-800/60',
  danger: 'bg-blood-500 text-ink-50 hover:bg-blood-400 active:bg-blood-600 font-semibold',
};

const SIZES: Record<ButtonSize, string> = {
  // Alvos de toque de 44px: a plataforma nasce pensada para o celular.
  sm: 'min-h-[36px] px-3 text-sm',
  md: 'min-h-[44px] px-4 text-[0.95rem]',
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
        'inline-flex items-center justify-center gap-2 rounded-lg transition-colors',
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

export function Panel({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div {...rest} className={cx('lt-panel p-4 sm:p-5', className)}>
      {children}
    </div>
  );
}

export function PanelTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-sm uppercase tracking-[0.18em] text-ember-300">{children}</h2>
      {hint && <span className="text-xs text-ink-300">{hint}</span>}
    </div>
  );
}

type BadgeTone = 'neutral' | 'ember' | 'arcane' | 'blood' | 'moss';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-ink-800 text-ink-200 border-ink-700',
  ember: 'bg-ember-700/25 text-ember-300 border-ember-700/50',
  arcane: 'bg-arcane-600/25 text-arcane-300 border-arcane-600/50',
  blood: 'bg-blood-600/25 text-blood-400 border-blood-600/50',
  moss: 'bg-moss-600/25 text-moss-400 border-moss-600/50',
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
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-ui text-[11px] font-medium uppercase tracking-wide',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Barra de recurso (vida, mana). Acessivel como progressbar. */
export function Meter({
  label,
  current,
  max,
  color,
  compact = false,
}: {
  label: string;
  current: number;
  max: number;
  color?: string;
  compact?: boolean;
}) {
  const safeMax = Math.max(1, max);
  const ratio = Math.max(0, Math.min(1, current / safeMax));
  const critical = ratio <= 0.25;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between font-ui text-xs">
        <span className={cx('text-ink-300', critical && 'text-blood-400')}>{label}</span>
        <span className="tabular-nums text-ink-200">
          {Math.round(current)} / {Math.round(safeMax)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(current)}
        aria-valuemin={0}
        aria-valuemax={Math.round(safeMax)}
        className={cx('overflow-hidden rounded-full bg-ink-800', compact ? 'h-1.5' : 'h-2.5')}
      >
        <div
          className={cx('h-full rounded-full transition-[width] duration-500', critical && 'animate-pulse-soft')}
          style={{
            width: `${ratio * 100}%`,
            backgroundColor: color ?? (critical ? '#c0392b' : '#d2721f'),
          }}
        />
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cx('animate-spin text-current', className ?? 'h-5 w-5')}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LoadingBlock({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-ink-300" role="status">
      <Spinner />
      <span className="font-ui text-sm">{label}</span>
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
    <Panel className="border-blood-600/40 bg-blood-600/10">
      <h2 className="font-display text-base text-blood-400">{title}</h2>
      <p className="mt-1 font-ui text-sm text-ink-200">{message}</p>
      {onRetry && (
        <Button className="mt-3" size="sm" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </Panel>
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
    <div className="lt-panel px-6 py-12 text-center">
      <h2 className="font-display text-lg text-ink-100">{title}</h2>
      <p className="mx-auto mt-2 max-w-md font-ui text-sm text-ink-300">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/** Parágrafos a partir de texto com linhas em branco. */
export function Narrative({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/).filter((part) => part.trim().length > 0);
  return (
    <div className="lt-prose lt-narrative">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}
