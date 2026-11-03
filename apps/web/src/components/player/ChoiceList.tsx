import type { ChoiceView } from '@lonetale/engine';

import { Badge, Spinner, cx } from '../ui';

/**
 * Lista de escolhas.
 *
 * A disponibilidade e o motivo do bloqueio chegam prontos do servidor: o
 * cliente nao reavalia nenhuma condicao da aventura, so a desenha. Escolhas
 * ocultas pelo autor (`unavailableBehavior: "hide"`) nem chegam aqui.
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
        const isPending = pendingChoiceId === choice.id;
        const isDisabled = disabled || !choice.available || isPending;

        return (
          <li key={choice.id}>
            <button
              type="button"
              onClick={() => onChoose(choice.id)}
              disabled={isDisabled}
              aria-describedby={choice.blockedReason ? `reason-${choice.id}` : undefined}
              className={cx(
                'group w-full rounded-xl border px-4 py-3.5 text-left transition-all',
                'min-h-[44px] focus-visible:outline-2',
                choice.available
                  ? 'border-ink-700 bg-ink-800/50 hover:border-ember-500/60 hover:bg-ink-800 active:translate-y-px'
                  : 'cursor-not-allowed border-ink-800 bg-ink-900/40 opacity-70',
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={cx(
                    'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                    choice.available ? 'bg-ember-400 group-hover:bg-ember-300' : 'bg-ink-600',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <span
                    className={cx(
                      'block font-body text-[1.0625rem] leading-snug',
                      choice.available ? 'text-ink-50' : 'text-ink-300 line-through decoration-ink-600',
                    )}
                  >
                    {choice.label}
                  </span>

                  {choice.description && (
                    <span className="mt-1 block font-ui text-[13px] text-ink-300">
                      {choice.description}
                    </span>
                  )}

                  {choice.costs && choice.costs.length > 0 && (
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {choice.costs.map((cost, index) => (
                        <Badge key={index} tone={cost.kind === 'gold' ? 'ember' : 'arcane'}>
                          custa {cost.label}
                        </Badge>
                      ))}
                    </span>
                  )}

                  {!choice.available && choice.blockedReason && (
                    <span
                      id={`reason-${choice.id}`}
                      className="mt-1.5 block font-ui text-[13px] italic text-blood-400"
                    >
                      {choice.blockedReason}
                    </span>
                  )}
                </div>

                {isPending && <Spinner className="mt-0.5 h-4 w-4 text-ember-300" />}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
