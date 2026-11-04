import type { NodeView } from '@lonetale/engine';

import type { PersistedEvent } from '../../lib/queries';
import { IconChevronDown, IconCoins, IconDroplet, IconHeart } from '../icons';
import { OrnateDivider, OrnateFrame, Portrait } from '../ornate';
import { Meter, cx } from '../ui';
import { PLAYER_SECTIONS, type SectionActions } from './sections';

/**
 * Trilho do personagem (desktop).
 *
 * Retrato, vitais e um indice das secoes da ficha. Clicar numa secao abre-a
 * ali mesmo: o jogador nunca perde de vista a coluna de leitura, que e onde a
 * aventura acontece.
 */
export function CharacterRail({
  view,
  events,
  actions,
  openSection,
  onToggleSection,
}: {
  view: NodeView;
  events: PersistedEvent[];
  actions: SectionActions;
  openSection: string | null;
  onToggleSection: (id: string) => void;
}) {
  const { character } = view;
  const vital = character.resources.find((resource) => resource.vital);
  const others = character.resources.filter((resource) => !resource.vital);

  return (
    <OrnateFrame className="overflow-hidden">
      <div className="rail">
        {/* ------------------------------------------------------- identidade */}
        <div className="px-4 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <Portrait name={character.name} size="lg" />
            <div className="min-w-0">
              <h2 className="truncate font-display text-xl text-parchment-50">{character.name}</h2>
              <p className="truncate font-sans text-[12px] text-bronze-300">
                {[character.raceName, character.className].filter(Boolean).join(' ')}
              </p>
              <p className="font-sans text-[12px] text-parchment-400">Nível {character.level}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            {vital && (
              <Meter
                label={vital.name}
                icon={<IconHeart className="h-4 w-4 text-blood-500" />}
                current={vital.current}
                max={vital.max}
                color={vital.color ?? '#c0392b'}
              />
            )}
            {others.map((resource) => (
              <Meter
                key={resource.id}
                label={resource.name}
                icon={<IconDroplet className="h-4 w-4 text-arcane-400" />}
                current={resource.current}
                max={resource.max}
                color={resource.color ?? '#2d7dd2'}
              />
            ))}

            <div className="flex items-center justify-between pt-0.5">
              <span className="flex items-center gap-1.5 font-sans text-xs text-parchment-300">
                <IconCoins className="h-4 w-4 text-gold-400" />
                Ouro
              </span>
              <span className="font-display text-base tabular-nums text-gold-300">
                {character.gold}
              </span>
            </div>
          </div>
        </div>

        <OrnateDivider tone="dark" className="px-4 pb-1" />

        {/* ---------------------------------------------------------- secoes */}
        <nav className="p-2" aria-label="Ficha do personagem">
          {PLAYER_SECTIONS.map((section) => {
            const Icon = section.icon;
            const open = openSection === section.id;
            const badge = section.badge?.(view) ?? null;

            return (
              <div key={section.id}>
                <button
                  type="button"
                  onClick={() => onToggleSection(section.id)}
                  aria-expanded={open}
                  className={cx(
                    'tap flex w-full items-center gap-2.5 rounded-md px-2.5 text-left transition-colors',
                    open
                      ? 'border border-bronze-400 bg-night-700 text-gold-300 shadow-gold'
                      : 'border border-transparent text-parchment-200 hover:bg-night-700/60',
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="mr-auto font-display text-[0.95rem]">{section.label}</span>
                  {badge !== null && (
                    <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full border border-blood-700 bg-blood-500 px-1 font-sans text-[10px] font-bold text-parchment-50">
                      {badge}
                    </span>
                  )}
                  <IconChevronDown
                    className={cx(
                      'h-4 w-4 shrink-0 text-bronze-300 transition-transform',
                      open && 'rotate-180',
                    )}
                  />
                </button>

                {open && (
                  <div className="animate-fade-up px-1 pb-3 pt-2">
                    {section.render({ view, actions, events })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </OrnateFrame>
  );
}

/** Faixa compacta do personagem usada no topo da tela no celular. */
export function CharacterStrip({ view }: { view: NodeView }) {
  const { character } = view;
  const vital = character.resources.find((resource) => resource.vital);
  const mana = character.resources.find((resource) => !resource.vital);

  return (
    <OrnateFrame className="overflow-hidden">
      <div className="rail flex items-center gap-3 px-3 py-2.5">
        <Portrait name={character.name} size="md" />

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base leading-tight text-parchment-50">
            {character.name}
          </p>
          <p className="truncate font-sans text-[11px] text-bronze-300">
            {[character.raceName, character.className].filter(Boolean).join(' ')} · Nível{' '}
            {character.level}
          </p>
        </div>

        <div className="w-[38%] min-w-[130px] shrink-0 space-y-1.5">
          {vital && (
            <Meter
              inline
              label={vital.name}
              icon={<IconHeart className="h-3.5 w-3.5 text-blood-500" />}
              current={vital.current}
              max={vital.max}
              color={vital.color ?? '#c0392b'}
            />
          )}
          {mana && (
            <Meter
              inline
              label={mana.name}
              icon={<IconDroplet className="h-3.5 w-3.5 text-arcane-400" />}
              current={mana.current}
              max={mana.max}
              color={mana.color ?? '#2d7dd2'}
            />
          )}
        </div>

        <div className="shrink-0 text-right">
          <span className="flex items-center gap-1 font-sans text-[11px] text-parchment-300">
            <IconCoins className="h-3.5 w-3.5 text-gold-400" />
            Ouro
          </span>
          <span className="font-display text-base tabular-nums text-gold-300">{character.gold}</span>
        </div>
      </div>
    </OrnateFrame>
  );
}
