import type { CharacterSheetView, QuestView } from '@lonetale/engine';

import { Badge, Button, Meter, Panel, PanelTitle } from '../ui';

const QUEST_TONES: Record<string, 'neutral' | 'ember' | 'moss' | 'blood'> = {
  active: 'ember',
  available: 'neutral',
  completed: 'moss',
  failed: 'blood',
};

const QUEST_LABELS: Record<string, string> = {
  available: 'disponível',
  active: 'em andamento',
  completed: 'concluída',
  failed: 'fracassada',
};

export function CharacterPanel({
  character,
  quests,
  variables,
  onAllocate,
  allocating = false,
}: {
  character: CharacterSheetView;
  quests: QuestView[];
  variables: Array<{ id: string; label: string; value: string | number | boolean | null }>;
  onAllocate?: (attributeId: string) => void;
  allocating?: boolean;
}) {
  const pending = character.pendingAttributePoints;

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg text-ink-50">{character.name}</h2>
            <p className="font-ui text-xs text-ink-300">
              {[character.raceName, character.className].filter(Boolean).join(' · ')}
              {' · '}
              nível {character.level}
            </p>
          </div>
          <Badge tone="ember">{character.gold} ouro</Badge>
        </div>

        <div className="mt-4 space-y-3">
          {character.resources.map((resource) => (
            <Meter
              key={resource.id}
              label={resource.name}
              current={resource.current}
              max={resource.max}
              {...(resource.color ? { color: resource.color } : {})}
            />
          ))}
          {character.experienceToNextLevel !== null && (
            <p className="font-ui text-[11px] text-ink-400">
              {character.experienceToNextLevel} de experiência para o próximo nível
            </p>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelTitle hint={character.armor > 0 ? `armadura ${character.armor}` : undefined}>
          Atributos
        </PanelTitle>

        {pending > 0 && (
          <p className="mb-3 rounded-lg border border-ember-700/50 bg-ember-700/15 px-3 py-2 font-ui text-xs text-ember-300">
            Você tem {pending} ponto{pending > 1 ? 's' : ''} para distribuir.
          </p>
        )}

        <dl className="grid grid-cols-2 gap-2">
          {character.attributes.map((attribute) => (
            <div
              key={attribute.id}
              className="flex items-center justify-between rounded-lg bg-ink-800/50 px-3 py-2"
            >
              <dt className="font-ui text-xs text-ink-300" title={attribute.name}>
                {attribute.abbreviation ?? attribute.name}
              </dt>
              <dd className="flex items-center gap-2">
                <span className="font-display text-base tabular-nums text-ink-50">
                  {attribute.total}
                </span>
                {attribute.modifier !== 0 && (
                  <span className="font-ui text-[11px] tabular-nums text-ink-400">
                    {attribute.modifier > 0 ? '+' : ''}
                    {attribute.modifier}
                  </span>
                )}
                {pending > 0 && onAllocate && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-0 px-1.5 py-0 text-ember-300"
                    aria-label={`Aumentar ${attribute.name}`}
                    loading={allocating}
                    onClick={() => onAllocate(attribute.id)}
                  >
                    +
                  </Button>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </Panel>

      {character.skills.length > 0 && (
        <Panel>
          <PanelTitle>Habilidades</PanelTitle>
          <ul className="space-y-2">
            {character.skills.map((skill) => (
              <li key={skill.id}>
                <div className="flex items-center gap-2">
                  <span className="font-body text-sm text-ink-100">{skill.name}</span>
                  <Badge tone={skill.kind === 'active' ? 'arcane' : 'neutral'}>
                    {skill.kind === 'active'
                      ? 'ativa'
                      : skill.kind === 'proficiency'
                        ? 'perícia'
                        : 'passiva'}
                  </Badge>
                </div>
                {skill.description && (
                  <p className="font-ui text-[12px] text-ink-400">{skill.description}</p>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {quests.length > 0 && (
        <Panel>
          <PanelTitle>Missões</PanelTitle>
          <ul className="space-y-3">
            {quests.map((quest) => (
              <li key={quest.id}>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-body text-sm text-ink-100">{quest.name}</span>
                  <Badge tone={QUEST_TONES[quest.status] ?? 'neutral'}>
                    {QUEST_LABELS[quest.status] ?? quest.status}
                  </Badge>
                </div>
                {quest.stageTitle && (
                  <p className="font-ui text-[12px] text-ink-400">{quest.stageTitle}</p>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {variables.length > 0 && (
        <Panel>
          <PanelTitle>Diário</PanelTitle>
          <dl className="space-y-1.5">
            {variables.map((variable) => (
              <div key={variable.id} className="flex items-baseline justify-between gap-3">
                <dt className="font-ui text-xs text-ink-300">{variable.label}</dt>
                <dd className="font-ui text-xs tabular-nums text-ink-100">
                  {typeof variable.value === 'boolean'
                    ? variable.value
                      ? 'sim'
                      : 'não'
                    : String(variable.value ?? '—')}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      )}
    </div>
  );
}
