import type { NodeView } from '@lonetale/engine';

import { IconChevronRight, IconCoins, IconDroplet, IconHeart } from '../icons';
import { CharacterAvatar, DecorativeVignette, OrnateDivider, OrnateFrame } from '../ornate';
import { Meter, cx } from '../ui';
import { PLAYER_SECTIONS } from './sections';

/**
 * Trilho do personagem (desktop).
 *
 * Retrato, vitais e um indice compacto das secoes da ficha: os sete itens
 * cabem sem rolagem, e e por isso que abrir uma secao leva o conteudo para um
 * painel sobre a tela em vez de expandir aqui dentro.
 */
export function CharacterRail({
  view,
  activeSection,
  onOpenSection,
}: {
  view: NodeView;
  activeSection: string | null;
  onOpenSection: (id: string) => void;
}) {
  const { character } = view;
  const vital = character.resources.find((resource) => resource.vital);
  const others = character.resources.filter((resource) => !resource.vital);

  return (
    <OrnateFrame className="overflow-hidden">
      <div className="rail relative flex min-h-[640px] flex-col">
        {/* ------------------------------------------------------- identidade */}
        <div className="relative z-10 px-4 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <CharacterAvatar
              name={character.name}
              size="lg"
              skin={character.appearanceColors['cor-da-pele']}
              hair={character.appearanceColors['cor-dos-cabelos']}
            />
            <div className="min-w-0">
              <h2 className="truncate font-display text-xl leading-tight text-parchment-50">
                {character.name}
              </h2>
              <p className="truncate font-sans text-[12.5px] text-bronze-300">
                {[character.className, character.raceName].filter(Boolean).join(' ')}
              </p>
              <p className="font-sans text-[12.5px] text-parchment-400">Nível {character.level}</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {vital && (
              <Meter
                label={vital.abbreviation ?? vital.name}
                icon={<IconHeart className="h-[15px] w-[15px] text-blood-500" />}
                current={vital.current}
                max={vital.max}
                color={vital.color ?? '#c0392b'}
              />
            )}
            {others.map((resource) => (
              <Meter
                key={resource.id}
                label={resource.abbreviation ?? resource.name}
                icon={<IconDroplet className="h-[15px] w-[15px] text-arcane-400" />}
                current={resource.current}
                max={resource.max}
                color={resource.color ?? '#2d7dd2'}
              />
            ))}

            <div className="flex items-center justify-between pt-0.5">
              <span className="flex items-center gap-1.5 font-sans text-xs text-parchment-300">
                <IconCoins className="h-[15px] w-[15px] text-gold-400" />
                Ouro
              </span>
              <span className="font-display text-base tabular-nums text-gold-300">
                {character.gold}
              </span>
            </div>
          </div>
        </div>

        <OrnateDivider tone="dark" className="relative z-10 px-4 pb-1" />

        {/* ---------------------------------------------------------- indice */}
        <nav className="relative z-10 p-2" aria-label="Ficha do personagem">
          {PLAYER_SECTIONS.map((section) => {
            const Icon = section.icon;
            const active = activeSection === section.id;
            const badge = section.badge?.(view) ?? null;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onOpenSection(section.id)}
                className={cx(
                  'tap flex w-full items-center gap-2.5 rounded-md px-2.5 text-left transition-colors',
                  active
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
                <IconChevronRight className="h-4 w-4 shrink-0 text-bronze-400" />
              </button>
            );
          })}
        </nav>

        {/* --------------------------------------------- vinheta no rodape */}
        <DecorativeVignette className="mt-auto h-32 w-full text-bronze-500/60" />
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
      {/* Duas linhas: identidade em cima, vitais embaixo. Em 375px uma linha
          so obrigaria a truncar "Guerreiro Humano", que e justamente o que o
          jogador quer ler de relance. */}
      <div className="rail px-3 py-2.5">
        <div className="flex items-center gap-3">
          <CharacterAvatar
            name={character.name}
            size="md"
            skin={character.appearanceColors['cor-da-pele']}
            hair={character.appearanceColors['cor-dos-cabelos']}
          />

          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base leading-tight text-parchment-50">
              {character.name}
            </p>
            <p className="truncate font-sans text-[11.5px] text-bronze-300">
              {[character.className, character.raceName].filter(Boolean).join(' ')} · Nível{' '}
              {character.level}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <span className="flex items-center justify-end gap-1 font-sans text-[11px] text-parchment-300">
              <IconCoins className="h-3.5 w-3.5 text-gold-400" />
              Ouro
            </span>
            <span className="font-display text-base leading-tight tabular-nums text-gold-300">
              {character.gold}
            </span>
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
          {vital && (
            <Meter
              label={vital.abbreviation ?? vital.name}
              icon={<IconHeart className="h-3.5 w-3.5 text-blood-500" />}
              current={vital.current}
              max={vital.max}
              color={vital.color ?? '#c0392b'}
              compact
            />
          )}
          {mana && (
            <Meter
              label={mana.abbreviation ?? mana.name}
              icon={<IconDroplet className="h-3.5 w-3.5 text-arcane-400" />}
              current={mana.current}
              max={mana.max}
              color={mana.color ?? '#2d7dd2'}
              compact
            />
          )}
        </div>
      </div>
    </OrnateFrame>
  );
}
