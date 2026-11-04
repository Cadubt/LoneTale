import type { ChoiceView } from '@lonetale/engine';

import { CHOICE_ICONS, IconCheck, IconChevronRight, IconLock, IconStar } from '../icons';
import { Spinner, cx } from '../ui';

/**
 * As escolhas, sobre o pergaminho.
 *
 * Tres estados visuais, e cada um conta algo diferente ao jogador:
 *
 * - **dourado** — a opcao existe porque voce cumpre alguma condicao (tem a
 *   corda, conhece a magia). E a recompensa de ter se preparado, entao merece
 *   destaque e o selo do que a destravou;
 * - **pergaminho** — sempre esteve ali, sem exigencia;
 * - **apagado** — visivel mas trancada, com o motivo escrito. O autor decide se
 *   ela aparece assim ou some de vez (`unavailableBehavior`).
 *
 * Nada disso e decidido aqui: `available`, `conditional` e `satisfiedLabel`
 * chegam prontos do servidor.
 */
export function ChoiceList({
  choices,
  onChoose,
  pendingChoiceId,
  disabled = false,
}: {
  choices: ChoiceView[];
  onChoose: (choiceId: string) => void;
  pendingChoiceId?: string | null;
  disabled?: boolean;
}) {
  if (choices.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-2.5">
      {choices.map((choice) => {
        const pending = pendingChoiceId === choice.id;
        const locked = !choice.available;
        // Dourado apenas quando da para dizer *o que* destravou a opcao. Uma
        // escolha condicionada a algo que nao se revela (uma flag da trama)
        // continua discreta -- destaca-la entregaria o enredo.
        const highlighted = choice.available && Boolean(choice.satisfiedLabel);
        const Icon =
          (choice.icon && CHOICE_ICONS[choice.icon]) ??
          (highlighted ? IconStar : undefined);

        return (
          <li key={choice.id}>
            <button
              type="button"
              onClick={() => onChoose(choice.id)}
              disabled={disabled || locked || pending}
              aria-describedby={choice.blockedReason ? `motivo-${choice.id}` : undefined}
              className={cx(
                'group relative flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left transition-all',
                'tap focus-visible:outline-2',
                locked
                  ? 'cursor-not-allowed border-bronze-500/40 bg-parchment-300/50 text-sepia-500'
                  : highlighted
                    ? 'border-bronze-400 bg-gold-choice text-sepia-900 shadow-gold hover:brightness-[1.04] active:translate-y-px'
                    : 'border-bronze-400/70 bg-parchment-100/80 text-sepia-800 hover:border-bronze-400 hover:bg-parchment-50 active:translate-y-px',
              )}
            >
              {Icon && (
                <Icon
                  className={cx(
                    'h-5 w-5 shrink-0',
                    locked ? 'text-sepia-400' : highlighted ? 'text-sepia-800' : 'text-sepia-500',
                  )}
                />
              )}

              <span className="min-w-0 flex-1">
                <span
                  className={cx(
                    'block font-body text-[1.0625rem] leading-snug',
                    highlighted && 'font-semibold',
                  )}
                >
                  {choice.label}
                </span>

                {choice.description && !locked && (
                  <span className="mt-0.5 block font-sans text-[12.5px] leading-snug text-sepia-500">
                    {choice.description}
                  </span>
                )}

                {locked && choice.blockedReason && (
                  <span
                    id={`motivo-${choice.id}`}
                    className="mt-0.5 flex items-center gap-1.5 font-sans text-[12.5px] text-blood-600"
                  >
                    <IconLock className="h-3.5 w-3.5 shrink-0" />
                    {choice.blockedReason}
                  </span>
                )}
              </span>

              {/* selo da direita: o que destravou, ou o custo */}
              <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                {choice.satisfiedLabel && (
                  <span className="flex items-center gap-1.5 font-sans text-[12.5px] text-moss-600">
                    <IconCheck className="h-4 w-4" strokeWidth={2.4} />
                    Você possui: {choice.satisfiedLabel}
                  </span>
                )}
                {choice.costs?.map((cost, index) => (
                  <span
                    key={index}
                    className="rounded-full border border-arcane-600/50 bg-arcane-600/15 px-2 py-0.5 font-sans text-[11px] uppercase tracking-wide text-arcane-600"
                  >
                    custa {cost.label}
                  </span>
                ))}
              </span>

              {pending ? (
                <Spinner className="h-4 w-4 shrink-0" />
              ) : (
                <IconChevronRight
                  className={cx(
                    'h-5 w-5 shrink-0 transition-transform',
                    locked ? 'text-sepia-400' : 'text-sepia-500 group-hover:translate-x-0.5',
                  )}
                />
              )}
            </button>

            {/* no celular os selos vao para baixo, para nao espremer o rotulo */}
            {(choice.satisfiedLabel || (choice.costs && choice.costs.length > 0)) && (
              <span className="mt-1 flex flex-wrap gap-1.5 px-3 sm:hidden">
                {choice.satisfiedLabel && (
                  <span className="flex items-center gap-1 font-sans text-[12px] text-moss-500">
                    <IconCheck className="h-3.5 w-3.5" strokeWidth={2.4} />
                    Você possui: {choice.satisfiedLabel}
                  </span>
                )}
                {choice.costs?.map((cost, index) => (
                  <span
                    key={index}
                    className="rounded-full border border-arcane-600/50 bg-arcane-600/15 px-2 py-0.5 font-sans text-[11px] uppercase tracking-wide text-arcane-300"
                  >
                    custa {cost.label}
                  </span>
                ))}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
