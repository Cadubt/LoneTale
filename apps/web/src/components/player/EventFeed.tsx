import type { GameEvent } from '@lonetale/engine';

import { Panel, PanelTitle } from '../ui';

/**
 * Traduz os eventos do motor para uma linha legivel.
 *
 * Devolve `null` para eventos que nao interessam ao jogador (efeitos pulados,
 * entradas em nos), mantendo o feed curto e informativo.
 */
function describe(event: GameEvent): { text: string; tone: string } | null {
  switch (event.type) {
    case 'choiceTaken':
      return { text: `Você escolheu: ${event.label}`, tone: 'text-ink-300' };
    case 'diceRolled':
      return {
        text: `${event.roll.expression} → ${event.roll.dice.join(' + ')}${
          event.roll.modifier !== 0 ? ` ${event.roll.modifier > 0 ? '+' : ''}${event.roll.modifier}` : ''
        }${event.roll.bonus ? ` ${event.roll.bonus > 0 ? '+' : ''}${event.roll.bonus}` : ''} = ${event.roll.total}`,
        tone: 'text-arcane-300',
      };
    case 'skillCheckResolved':
      return {
        text: event.success
          ? `Teste bem-sucedido (${event.total} contra ${event.difficulty})${
              event.critical === 'success' ? ' — crítico!' : ''
            }`
          : `Teste fracassado (${event.total} contra ${event.difficulty})${
              event.critical === 'failure' ? ' — falha crítica!' : ''
            }`,
        tone: event.success ? 'text-moss-400' : 'text-blood-400',
      };
    case 'itemGained':
      return { text: `Você obteve ${event.quantity}× ${event.itemId}`, tone: 'text-moss-400' };
    case 'itemLost':
      return { text: `Você perdeu ${event.quantity}× ${event.itemId}`, tone: 'text-ink-400' };
    case 'itemEquipped':
      return { text: `Equipou ${event.itemId}`, tone: 'text-ink-300' };
    case 'goldChanged':
      return {
        text: `${event.delta > 0 ? '+' : ''}${event.delta} de ouro (total ${event.total})`,
        tone: event.delta > 0 ? 'text-ember-300' : 'text-ink-400',
      };
    case 'resourceChanged':
      return {
        text: `${event.resourceId}: ${event.delta > 0 ? '+' : ''}${event.delta} (${event.current}/${event.max})`,
        tone: event.delta > 0 ? 'text-moss-400' : 'text-blood-400',
      };
    case 'experienceGained':
      return { text: `+${event.amount} de experiência`, tone: 'text-arcane-300' };
    case 'leveledUp':
      return { text: `Você alcançou o nível ${event.level}!`, tone: 'text-ember-300' };
    case 'skillUnlocked':
      return { text: `Nova habilidade: ${event.skillId}`, tone: 'text-arcane-300' };
    case 'questChanged':
      return { text: `Missão ${event.questId}: ${event.status}`, tone: 'text-ink-300' };
    case 'combatStarted':
      return { text: 'O combate começou.', tone: 'text-blood-400' };
    case 'combatAttack':
      return {
        text: event.hit
          ? `${event.actorName} acertou ${event.targetName} (${event.damage} de dano)`
          : `${event.actorName} errou o ataque em ${event.targetName}`,
        tone: event.source === 'player' ? 'text-ink-200' : 'text-blood-400',
      };
    case 'combatSkillUsed':
      return {
        text: `${event.skillId}${event.damage ? ` — ${event.damage} de dano` : ''}${
          event.healing ? ` — ${event.healing} de cura` : ''
        }`,
        tone: 'text-arcane-300',
      };
    case 'combatantDefeated':
      return { text: `${event.name} foi derrotado.`, tone: 'text-moss-400' };
    case 'combatEnded':
      return {
        text:
          event.resolution === 'victory'
            ? 'Vitória no combate.'
            : event.resolution === 'fled'
              ? 'Você conseguiu fugir.'
              : 'Você foi derrotado.',
        tone: event.resolution === 'victory' ? 'text-moss-400' : 'text-blood-400',
      };
    case 'characterDied':
      return { text: 'Você caiu.', tone: 'text-blood-400' };
    case 'checkpointSaved':
      return { text: `Progresso salvo${event.label ? `: ${event.label}` : ''}.`, tone: 'text-ink-400' };
    case 'checkpointRestored':
      return { text: 'Você retomou do último ponto seguro.', tone: 'text-ember-300' };
    case 'adventureEnded':
      return { text: 'A aventura chegou ao fim.', tone: 'text-ember-300' };
    case 'warning':
      return { text: event.message, tone: 'text-ink-400' };
    default:
      return null;
  }
}

export function EventFeed({ events }: { events: GameEvent[] }) {
  const lines = events.map(describe).filter((line): line is NonNullable<typeof line> => line !== null);

  if (lines.length === 0) {
    return null;
  }

  return (
    <Panel>
      <PanelTitle>O que aconteceu</PanelTitle>
      <ol className="lt-scrollbar max-h-64 space-y-1.5 overflow-y-auto pr-1" aria-live="polite">
        {lines.map((line, index) => (
          <li key={index} className={`font-ui text-[13px] ${line.tone} animate-fade-up`}>
            {line.text}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
