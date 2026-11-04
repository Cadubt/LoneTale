import type { NodeView } from '@lonetale/engine';
import type { ReactNode } from 'react';

import type { PersistedEvent } from '../../lib/queries';
import {
  IconBackpack,
  IconBars,
  IconBook,
  IconCart,
  IconChat,
  IconCheck,
  IconClock,
  IconDice,
  IconFlag,
  IconFootsteps,
  IconScroll,
  IconShield,
  IconSkull,
  IconSparkles,
  IconStar,
  IconSwords,
} from '../icons';
import { OrnateDivider } from '../ornate';
import { Badge, Button, cx } from '../ui';

export interface SectionActions {
  onUse: (itemId: string) => void;
  onEquip: (itemId: string) => void;
  onUnequip: (slot: string) => void;
  onAllocate: (attributeId: string) => void;
  busy: boolean;
  interactive: boolean;
}

interface SectionProps {
  view: NodeView;
  actions: SectionActions;
  events: PersistedEvent[];
}

const KIND_LABELS: Record<string, string> = {
  weapon: 'arma',
  armor: 'armadura',
  shield: 'escudo',
  accessory: 'acessório',
  consumable: 'consumível',
  quest: 'missão',
  misc: 'diverso',
};

const SLOT_LABELS: Record<string, string> = {
  maoPrincipal: 'Mão principal',
  maoSecundaria: 'Mão secundária',
  corpo: 'Corpo',
  acessorio: 'Acessório',
};

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-1 font-sans text-[13px] text-parchment-400">{children}</p>;
}

// ------------------------------------------------------------------ itens
export function InventorySection({ view, actions }: SectionProps) {
  if (view.inventory.length === 0) {
    return <Empty>Você não carrega nada.</Empty>;
  }

  return (
    <ul className="space-y-1.5">
      {view.inventory.map((item) => {
        const equippable =
          Boolean(item.slot) && !['consumable', 'quest', 'misc'].includes(item.kind);

        return (
          <li
            key={item.itemId}
            className="rounded-md border border-bronze-600/70 bg-night-800/60 px-2.5 py-2"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-body text-sm text-parchment-100">{item.name}</span>
              {item.quantity > 1 && (
                <span className="font-sans text-xs tabular-nums text-parchment-400">
                  ×{item.quantity}
                </span>
              )}
              {item.equipped && <Badge tone="moss">equipado</Badge>}
              <Badge className="ml-auto">{KIND_LABELS[item.kind] ?? item.kind}</Badge>
            </div>

            {item.description && (
              <p className="mt-0.5 font-sans text-[12px] leading-snug text-parchment-400">
                {item.description}
              </p>
            )}

            {actions.interactive && (item.usable || equippable) && (
              <div className="mt-1.5 flex gap-1.5">
                {item.usable && (
                  <Button size="sm" loading={actions.busy} onClick={() => actions.onUse(item.itemId)}>
                    Usar
                  </Button>
                )}
                {equippable && !item.equipped && (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={actions.busy}
                    onClick={() => actions.onEquip(item.itemId)}
                  >
                    Equipar
                  </Button>
                )}
                {equippable && item.equipped && item.slot && (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={actions.busy}
                    onClick={() => actions.onUnequip(item.slot as string)}
                  >
                    Guardar
                  </Button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function EquipmentSection({ view, actions }: SectionProps) {
  const equipped = view.inventory.filter((item) => item.equipped);

  return (
    <div className="space-y-2">
      {equipped.length === 0 ? (
        <Empty>Nada equipado.</Empty>
      ) : (
        <ul className="space-y-1.5">
          {equipped.map((item) => (
            <li
              key={item.itemId}
              className="flex items-center gap-2 rounded-md border border-bronze-600/70 bg-night-800/60 px-2.5 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-body text-sm text-parchment-100">
                  {item.name}
                </span>
                <span className="block font-sans text-[11px] text-bronze-300">
                  {item.slot ? (SLOT_LABELS[item.slot] ?? item.slot) : KIND_LABELS[item.kind]}
                </span>
              </span>
              {actions.interactive && item.slot && (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={actions.busy}
                  onClick={() => actions.onUnequip(item.slot as string)}
                >
                  Guardar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between rounded-md bg-night-800/60 px-2.5 py-2">
        <span className="flex items-center gap-2 font-sans text-[13px] text-parchment-300">
          <IconShield className="h-4 w-4 text-bronze-300" />
          Armadura total
        </span>
        <span className="font-display text-base tabular-nums text-parchment-100">
          {view.character.armor}
        </span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- atributos
export function AttributesSection({ view, actions }: SectionProps) {
  const pending = view.character.pendingAttributePoints;

  return (
    <div className="space-y-2">
      {pending > 0 && (
        <p className="rounded-md border border-gold-500/50 bg-gold-500/15 px-2.5 py-1.5 font-sans text-[12px] text-gold-300">
          {pending} ponto{pending > 1 ? 's' : ''} para distribuir.
        </p>
      )}

      <dl className="space-y-1.5">
        {view.character.attributes.map((attribute) => (
          <div
            key={attribute.id}
            className="flex items-center gap-2 rounded-md bg-night-800/60 px-2.5 py-1.5"
          >
            <dt className="min-w-0 flex-1 truncate font-sans text-[13px] text-parchment-300">
              {attribute.name}
            </dt>
            <dd className="flex shrink-0 items-center gap-2">
              <span className="font-display text-base tabular-nums text-parchment-50">
                {attribute.total}
              </span>
              {attribute.modifier !== 0 && (
                <span
                  className={cx(
                    'font-sans text-[11px] tabular-nums',
                    attribute.modifier > 0 ? 'text-moss-400' : 'text-blood-400',
                  )}
                >
                  {attribute.modifier > 0 ? '+' : ''}
                  {attribute.modifier}
                </span>
              )}
              {pending > 0 && actions.interactive && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="min-h-[28px] px-2"
                  aria-label={`Aumentar ${attribute.name}`}
                  loading={actions.busy}
                  onClick={() => actions.onAllocate(attribute.id)}
                >
                  +
                </Button>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex items-center justify-between px-2.5 font-sans text-[12px] text-parchment-400">
        <span>Experiência</span>
        <span className="tabular-nums">
          {view.character.experience}
          {view.character.experienceToNextLevel !== null &&
            ` · faltam ${view.character.experienceToNextLevel}`}
        </span>
      </div>
    </div>
  );
}

export function SkillsSection({ view }: SectionProps) {
  if (view.character.skills.length === 0) {
    return <Empty>Nenhuma habilidade aprendida.</Empty>;
  }
  return (
    <ul className="space-y-1.5">
      {view.character.skills.map((skill) => (
        <li key={skill.id} className="rounded-md bg-night-800/60 px-2.5 py-2">
          <div className="flex items-center gap-2">
            <IconSparkles className="h-4 w-4 shrink-0 text-arcane-300" />
            <span className="font-body text-sm text-parchment-100">{skill.name}</span>
            <Badge tone={skill.kind === 'active' ? 'arcane' : 'neutral'} className="ml-auto">
              {skill.kind === 'active' ? 'ativa' : skill.kind === 'proficiency' ? 'perícia' : 'passiva'}
            </Badge>
          </div>
          {skill.description && (
            <p className="mt-0.5 font-sans text-[12px] leading-snug text-parchment-400">
              {skill.description}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- missoes
const QUEST_LABELS: Record<string, string> = {
  available: 'disponível',
  active: 'em andamento',
  completed: 'concluída',
  failed: 'fracassada',
};

/** Missoes com caixa de selecao, como numa lista de tarefas do diario. */
export function QuestsSection({ view, tone = 'dark' }: SectionProps & { tone?: 'dark' | 'parchment' }) {
  if (view.quests.length === 0) {
    return <Empty>Nenhuma missão ainda.</Empty>;
  }

  const parchment = tone === 'parchment';

  return (
    <ul className="space-y-2.5">
      {view.quests.map((quest) => {
        const done = quest.status === 'completed';
        const failed = quest.status === 'failed';
        return (
          <li key={quest.id} className="flex gap-2.5">
            <span
              aria-hidden="true"
              className={cx(
                'mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded border',
                done
                  ? 'border-moss-600 bg-moss-500 text-night-900'
                  : failed
                    ? 'border-blood-600 bg-blood-600/30 text-blood-400'
                    : parchment
                      ? 'border-bronze-500 bg-parchment-50'
                      : 'border-bronze-500 bg-night-900',
              )}
            >
              {done && <IconCheck className="h-3 w-3" strokeWidth={3} />}
            </span>

            <div className="min-w-0">
              <p
                className={cx(
                  'font-body text-sm leading-snug',
                  done && 'line-through',
                  parchment
                    ? done
                      ? 'text-sepia-500'
                      : 'text-sepia-800'
                    : done
                      ? 'text-parchment-400'
                      : 'text-parchment-100',
                )}
              >
                {quest.name}
              </p>
              {(quest.description || quest.stageTitle) && (
                <p
                  className={cx(
                    'font-sans text-[12px] leading-snug',
                    parchment ? 'text-sepia-500' : 'text-parchment-400',
                  )}
                >
                  {quest.stageTitle ?? quest.description}
                </p>
              )}
              {!done && !failed && quest.status !== 'active' && (
                <Badge className="mt-1">{QUEST_LABELS[quest.status] ?? quest.status}</Badge>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function JournalSection({ view }: SectionProps) {
  if (view.variables.length === 0) {
    return <Empty>Nada anotado ainda.</Empty>;
  }
  return (
    <dl className="space-y-1.5">
      {view.variables.map((variable) => (
        <div
          key={variable.id}
          className="flex items-baseline justify-between gap-3 rounded-md bg-night-800/60 px-2.5 py-1.5"
        >
          <dt className="font-sans text-[13px] text-parchment-300">{variable.label}</dt>
          <dd className="font-sans text-[13px] tabular-nums text-parchment-100">
            {typeof variable.value === 'boolean'
              ? variable.value
                ? 'sim'
                : 'não'
              : String(variable.value ?? '—')}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// -------------------------------------------------------------- historico
interface HistoryLine {
  icon: (props: { className?: string }) => JSX.Element;
  text: string;
  tone: string;
}

/** Traduz um evento do motor para uma linha legivel do historico. */
export function describeEvent(raw: unknown): HistoryLine | null {
  const event = raw as Record<string, unknown> & { type?: string };
  switch (event.type) {
    case 'choiceTaken':
      return { icon: IconFootsteps, text: `Você escolheu: ${event.label}`, tone: 'text-parchment-300' };
    case 'itemGained':
      return {
        icon: IconCart,
        text: `Você obteve ${event.quantity}× ${event.itemName ?? event.itemId}.`,
        tone: 'text-moss-400',
      };
    case 'itemLost':
      return {
        icon: IconCart,
        text: `Você entregou ${event.quantity}× ${event.itemName ?? event.itemId}.`,
        tone: 'text-parchment-400',
      };
    case 'itemEquipped':
      return { icon: IconShield, text: `Você equipou ${event.itemName ?? event.itemId}.`, tone: 'text-parchment-300' };
    case 'goldChanged':
      return {
        icon: IconCart,
        text:
          (event.delta as number) > 0
            ? `Você recebeu ${event.delta} de ouro.`
            : `Você gastou ${Math.abs(event.delta as number)} de ouro.`,
        tone: (event.delta as number) > 0 ? 'text-gold-300' : 'text-parchment-400',
      };
    case 'diceRolled': {
      const roll = event.roll as { expression: string; total: number } | undefined;
      return roll
        ? { icon: IconDice, text: `Rolagem ${roll.expression}: ${roll.total}.`, tone: 'text-arcane-300' }
        : null;
    }
    case 'skillCheckResolved':
      return {
        icon: IconDice,
        text: event.success
          ? `Teste bem-sucedido (${event.total} contra ${event.difficulty}).`
          : `Teste fracassado (${event.total} contra ${event.difficulty}).`,
        tone: event.success ? 'text-moss-400' : 'text-blood-400',
      };
    case 'skillUnlocked':
      return { icon: IconStar, text: `Nova habilidade: ${event.skillName ?? event.skillId}.`, tone: 'text-arcane-300' };
    case 'experienceGained':
      return { icon: IconStar, text: `+${event.amount} de experiência.`, tone: 'text-arcane-300' };
    case 'leveledUp':
      return { icon: IconStar, text: `Você alcançou o nível ${event.level}!`, tone: 'text-gold-300' };
    case 'questChanged': {
      const name = event.questName ?? event.questId;
      const label = QUEST_LABELS[event.status as string] ?? (event.status as string);
      return { icon: IconScroll, text: `Missão "${name}": ${label}.`, tone: 'text-parchment-300' };
    }
    case 'combatStarted':
      return { icon: IconSwords, text: 'O combate começou.', tone: 'text-blood-400' };
    case 'combatAttack':
      return {
        icon: IconSwords,
        text: event.hit
          ? `${event.actorName} acertou ${event.targetName} (${event.damage} de dano).`
          : `${event.actorName} errou o ataque em ${event.targetName}.`,
        tone: event.source === 'player' ? 'text-parchment-200' : 'text-blood-400',
      };
    case 'combatantDefeated':
      return { icon: IconSkull, text: `${event.name} foi derrotado.`, tone: 'text-moss-400' };
    case 'combatEnded':
      return {
        icon: IconSwords,
        text:
          event.resolution === 'victory'
            ? 'Vitória no combate.'
            : event.resolution === 'fled'
              ? 'Você conseguiu fugir.'
              : 'Você foi derrotado.',
        tone: event.resolution === 'victory' ? 'text-moss-400' : 'text-blood-400',
      };
    case 'characterDied':
      return { icon: IconSkull, text: 'Você caiu.', tone: 'text-blood-400' };
    case 'checkpointSaved':
      return { icon: IconFlag, text: 'Progresso salvo.', tone: 'text-parchment-400' };
    case 'checkpointRestored':
      return { icon: IconFlag, text: 'Você retomou do último ponto seguro.', tone: 'text-gold-300' };
    case 'adventureEnded':
      return { icon: IconBook, text: 'A aventura chegou ao fim.', tone: 'text-gold-300' };
    case 'nodeEntered':
      return null;
    default:
      return null;
  }
}

export function HistorySection({
  events,
  tone = 'dark',
}: SectionProps & { tone?: 'dark' | 'parchment' }) {
  const lines = events
    .map((entry) => {
      try {
        return describeEvent(JSON.parse(entry.payload) as unknown);
      } catch {
        return null;
      }
    })
    .filter((line): line is HistoryLine => line !== null)
    .slice(0, 40);

  if (lines.length === 0) {
    return <Empty>Sua jornada ainda não deixou marcas.</Empty>;
  }

  const parchment = tone === 'parchment';

  return (
    <ol className="scrollbar-thin max-h-[22rem] space-y-2.5 overflow-y-auto pr-1" aria-live="polite">
      {lines.map((line, index) => {
        const Icon = line.icon;
        return (
          <li key={index} className="flex gap-2.5">
            <Icon
              className={cx('mt-0.5 h-4 w-4 shrink-0', parchment ? 'text-sepia-500' : 'text-bronze-300')}
            />
            <span
              className={cx(
                'font-sans text-[13px] leading-snug',
                parchment ? 'text-sepia-700' : line.tone,
              )}
            >
              {line.text}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------- registro
export interface SectionDefinition {
  id: string;
  label: string;
  icon: (props: { className?: string }) => JSX.Element;
  render: (props: SectionProps) => JSX.Element;
  badge?: (view: NodeView) => number | null;
}

export const PLAYER_SECTIONS: SectionDefinition[] = [
  {
    id: 'inventario',
    label: 'Inventário',
    icon: IconBackpack,
    render: (props) => <InventorySection {...props} />,
  },
  {
    id: 'equipamentos',
    label: 'Equipamentos',
    icon: IconSwords,
    render: (props) => <EquipmentSection {...props} />,
  },
  {
    id: 'atributos',
    label: 'Atributos',
    icon: IconBars,
    render: (props) => <AttributesSection {...props} />,
    badge: (view) => view.character.pendingAttributePoints || null,
  },
  {
    id: 'habilidades',
    label: 'Habilidades',
    icon: IconSparkles,
    render: (props) => <SkillsSection {...props} />,
  },
  {
    id: 'missoes',
    label: 'Missões',
    icon: IconScroll,
    render: (props) => <QuestsSection {...props} />,
    badge: (view) => view.quests.filter((quest) => quest.status === 'active').length || null,
  },
  { id: 'diario', label: 'Diário', icon: IconBook, render: (props) => <JournalSection {...props} /> },
  {
    id: 'historico',
    label: 'Histórico',
    icon: IconClock,
    render: (props) => <HistorySection {...props} />,
  },
];

export { OrnateDivider, IconChat };
