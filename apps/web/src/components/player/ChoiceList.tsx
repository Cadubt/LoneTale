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
 * O selo da direita e sempre o mesmo lugar: o que destravou a opcao, o que
 * falta para destravar, ou o que ela vai custar. O olho aprende onde procurar.
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
          (choice.icon && CHOICE_ICONS[choice.icon]) ?? (highlighted ? IconStar : undefined);

        const status = (
          <>
            {choice.satisfiedLabel && (
              <span className="flex items-start gap-1.5 font-sans text-[12.5px] leading-snug text-moss-600 sm:justify-end">
                <IconCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.4} />
                Você possui: {choice.satisfiedLabel}
              </span>
            )}
            {locked && choice.blockedReason && (
              <span
                id={`motivo-${choice.id}`}
                className="flex items-start gap-1.5 font-sans text-[12.5px] leading-snug text-blood-600 sm:justify-end"
              >
                <IconLock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {choice.blockedReason}
              </span>
            )}
            {/* O custo so interessa em opcao que da para escolher. Numa
                trancada, ele compete com o motivo do bloqueio. */}
            {!locked &&
              choice.costs?.map((cost, index) => (
                <span
                  key={index}
                  className="rounded-full border border-arcane-500/60 bg-arcane-500/15 px-2 py-0.5 font-sans text-[10.5px] uppercase tracking-wide text-arcane-600"
                  >
                  custa {cost.label}
                </span>
              ))}
          </>
        );

        const hasStatus =
          Boolean(choice.satisfiedLabel) ||
          (locked && Boolean(choice.blockedReason)) ||
          (!locked && (choice.costs?.length ?? 0) > 0);

        return (
          <li key={choice.id}>
            <button
              type="button"
              onClick={() => onChoose(choice.id)}
              disabled={disabled || locked || pending}
              aria-describedby={choice.blockedReason ? `motivo-${choice.id}` : undefined}
              className={cx(
                'group relative flex w-full items-center gap-3.5 rounded-md border px-4 py-3.5 text-left transition-all',
                'min-h-[60px] focus-visible:outline-2',
                locked
                  ? 'cursor-not-allowed border-bronze-500/35 bg-parchment-300/45 text-sepia-500'
                  : highlighted
                    ? 'border-bronze-400 bg-gold-choice text-sepia-900 shadow-gold hover:brightness-[1.04] active:translate-y-px'
                    : 'border-bronze-400/60 bg-parchment-100/75 text-sepia-800 hover:border-bronze-400 hover:bg-parchment-50 active:translate-y-px',
              )}
            >
              {Icon && (
                <span
                  className={cx(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-full border',
                    locked
                      ? 'border-bronze-500/30 bg-parchment-400/30 text-sepia-400'
                      : highlighted
                        ? 'border-sepia-900/25 bg-sepia-900/10 text-sepia-900'
                        : 'border-bronze-400/40 bg-parchment-300/50 text-sepia-600',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
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

                {/* No celular o selo vai abaixo do rotulo. Mante-lo a direita,
                    como no desktop, espremeria o texto a uma palavra por linha
                    assim que o nome do item fosse um pouco mais longo. */}
                {hasStatus && (
                  <span className="mt-1.5 flex flex-col gap-1 sm:hidden">{status}</span>
                )}
              </span>

              {hasStatus && (
                <span className="hidden shrink-0 flex-col items-end gap-1 text-right sm:flex sm:max-w-[240px]">
                  {status}
                </span>
              )}

              {pending ? (
                <Spinner className="h-5 w-5 shrink-0" />
              ) : (
                <IconChevronRight
                  className={cx(
                    'h-5 w-5 shrink-0 transition-transform',
                    locked ? 'text-sepia-400' : 'text-sepia-500 group-hover:translate-x-0.5',
                  )}
                />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
