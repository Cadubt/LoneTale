import { useState } from 'react';
import type { CombatView } from '@lonetale/engine';

import { Badge, Button, Meter, Panel, PanelTitle, cx } from '../ui';

/**
 * Painel de combate.
 *
 * O turno, as rodadas e o resultado de cada ataque vem do servidor; aqui so
 * escolhemos a acao e o alvo.
 */
export function CombatPanel({
  combat,
  onAttack,
  onSkill,
  onItem,
  onFlee,
  busy = false,
}: {
  combat: CombatView;
  onAttack: (targetInstanceId?: string) => void;
  onSkill: (skillId: string, targetInstanceId?: string) => void;
  onItem: (itemId: string) => void;
  onFlee: () => void;
  busy?: boolean;
}) {
  const alive = combat.enemies.filter((enemy) => enemy.alive);
  const [target, setTarget] = useState<string | null>(null);
  const effectiveTarget = target && alive.some((enemy) => enemy.instanceId === target)
    ? target
    : (alive[0]?.instanceId ?? null);

  const playerTurn = combat.turn === 'player';

  return (
    <Panel className="border-blood-600/40">
      <PanelTitle hint={`rodada ${combat.round}`}>
        {playerTurn ? 'Sua vez' : 'Turno das criaturas'}
      </PanelTitle>

      <ul className="space-y-3">
        {combat.enemies.map((enemy) => {
          const selected = effectiveTarget === enemy.instanceId;
          return (
            <li key={enemy.instanceId}>
              <button
                type="button"
                disabled={!enemy.alive || !playerTurn || busy}
                onClick={() => setTarget(enemy.instanceId)}
                aria-pressed={selected}
                className={cx(
                  'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
                  !enemy.alive
                    ? 'border-ink-800 bg-ink-900/40 opacity-50'
                    : selected
                      ? 'border-blood-500 bg-blood-600/15'
                      : 'border-ink-700 bg-ink-800/40 hover:border-blood-500/50',
                )}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="font-body text-sm text-ink-50">{enemy.name}</span>
                  {enemy.alive ? (
                    selected && <Badge tone="blood">alvo</Badge>
                  ) : (
                    <Badge>derrotado</Badge>
                  )}
                </div>
                <Meter label="Vida" current={enemy.hp} max={enemy.maxHp} color="#c0392b" compact />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 space-y-2">
        <Button
          variant="danger"
          block
          size="lg"
          disabled={!playerTurn || alive.length === 0}
          loading={busy}
          onClick={() => onAttack(effectiveTarget ?? undefined)}
        >
          Atacar
        </Button>

        {combat.usableSkills.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {combat.usableSkills.map((skill) => (
              <Button
                key={skill.skillId}
                variant="secondary"
                disabled={!playerTurn || !skill.available}
                loading={busy}
                onClick={() => onSkill(skill.skillId, effectiveTarget ?? undefined)}
                title={skill.blockedReason}
              >
                <span className="truncate">{skill.name}</span>
                {skill.cost && (
                  <span className="font-ui text-[11px] text-ink-300">−{skill.cost.amount}</span>
                )}
              </Button>
            ))}
          </div>
        )}

        {combat.usableItems.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {combat.usableItems.map((item) => (
              <Button
                key={item.itemId}
                variant="ghost"
                disabled={!playerTurn}
                loading={busy}
                onClick={() => onItem(item.itemId)}
              >
                <span className="truncate">
                  {item.name} {item.quantity > 1 && `(${item.quantity})`}
                </span>
              </Button>
            ))}
          </div>
        )}

        {combat.fleeAllowed && (
          <Button variant="ghost" block disabled={!playerTurn} loading={busy} onClick={onFlee}>
            Fugir
          </Button>
        )}
      </div>

      {combat.usableSkills.some((skill) => !skill.available && skill.blockedReason) && (
        <ul className="mt-3 space-y-1">
          {combat.usableSkills
            .filter((skill) => !skill.available && skill.blockedReason)
            .map((skill) => (
              <li key={skill.skillId} className="font-ui text-[12px] italic text-ink-400">
                {skill.name}: {skill.blockedReason}
              </li>
            ))}
        </ul>
      )}
    </Panel>
  );
}
