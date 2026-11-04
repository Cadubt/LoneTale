import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Badge, Button, ErrorNotice, LoadingBlock, Narrative, Panel, PanelTitle, cx } from '../components/ui';
import { ApiError } from '../lib/api-client';
import {
  useAdventureDetail,
  useStartSession,
  type AppearanceFieldView,
  type CharacterCreationOptionsView,
} from '../lib/queries';
import { useAuthStore } from '../store/auth-store';

/** Valor inicial de cada atributo na distribuicao de pontos. */
function attributeFloor(options: CharacterCreationOptionsView, attributeMin: number): number {
  return Math.max(attributeMin, options.attributes.minPerAttribute);
}

function attributeCeiling(options: CharacterCreationOptionsView, attributeMax: number): number {
  return Math.min(attributeMax, options.attributes.maxPerAttribute);
}

function AppearanceControl({
  field,
  value,
  allowedOptionIds,
  onChange,
}: {
  field: AppearanceFieldView;
  value: string | number | boolean | null | undefined;
  allowedOptionIds: string[] | null;
  onChange: (value: string | number) => void;
}) {
  const id = `appearance-${field.id}`;
  const options = (field.options ?? []).filter(
    (option) => !allowedOptionIds || allowedOptionIds.includes(option.id),
  );

  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-ui text-xs text-parchment-300">
        {field.label}
        {field.required && <span className="ml-1 text-ember-400">*</span>}
      </label>

      {field.kind === 'select' && (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby={id}>
          {options.map((option) => {
            const selected = value === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(option.id)}
                className={cx(
                  'inline-flex min-h-[36px] items-center gap-2 rounded-lg border px-3 font-ui text-[13px] transition-colors',
                  selected
                    ? 'border-ember-500 bg-ember-700/20 text-ember-200'
                    : 'border-night-700 bg-night-800/50 text-parchment-200 hover:border-bronze-600',
                )}
              >
                {option.color && (
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-3.5 rounded-full border border-bronze-600"
                    style={{ backgroundColor: option.color }}
                  />
                )}
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      {field.kind === 'number' && (
        <div className="flex items-center gap-3">
          <input
            id={id}
            type="range"
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={field.step ?? 1}
            value={typeof value === 'number' ? value : (field.min ?? 0)}
            onChange={(event) => onChange(Number(event.target.value))}
            className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-night-800 accent-ember-500"
          />
          <span className="w-20 shrink-0 text-right font-ui text-sm tabular-nums text-parchment-100">
            {typeof value === 'number' ? value : (field.min ?? 0)}
            {field.unit ? ` ${field.unit}` : ''}
          </span>
        </div>
      )}

      {field.kind === 'text' && (
        <input
          id={id}
          type="text"
          maxLength={field.maxLength}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-lg border border-night-700 bg-night-900/70 px-3 py-2.5 font-ui text-sm text-parchment-50 focus:border-ember-500 focus:outline-none"
        />
      )}

      {field.kind === 'color' && (
        <input
          id={id}
          type="color"
          value={typeof value === 'string' ? value : '#cccccc'}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-20 cursor-pointer rounded-lg border border-night-700 bg-night-900"
        />
      )}
    </div>
  );
}

export function AdventureDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const authenticated = useAuthStore((state) => Boolean(state.accessToken));
  const { data, isLoading, error, refetch } = useAdventureDetail(slug);
  const startSession = useStartSession();

  const [name, setName] = useState('');
  const [classId, setClassId] = useState<string | null>(null);
  const [raceId, setRaceId] = useState<string | null>(null);
  const [attributes, setAttributes] = useState<Record<string, number>>({});
  const [appearance, setAppearance] = useState<Record<string, string | number>>({});
  const [description, setDescription] = useState('');

  const creation = data?.characterCreation;

  // Estado inicial dos atributos, assim que as opcoes chegam.
  const baseAttributes = useMemo(() => {
    if (!creation) {
      return {};
    }
    return Object.fromEntries(
      creation.attributes.definitions.map((definition) => [
        definition.id,
        attributeFloor(creation, definition.min),
      ]),
    );
  }, [creation]);

  const currentAttributes = useMemo(
    () => ({ ...baseAttributes, ...attributes }),
    [baseAttributes, attributes],
  );

  const spent = useMemo(() => {
    if (!creation) {
      return 0;
    }
    return creation.attributes.definitions.reduce((total, definition) => {
      const floor = attributeFloor(creation, definition.min);
      return total + ((currentAttributes[definition.id] ?? floor) - floor);
    }, 0);
  }, [creation, currentAttributes]);

  const remaining = (creation?.attributes.points ?? 0) - spent;

  // Classes e racas se restringem mutuamente, conforme o documento declara.
  const availableRaces = useMemo(() => {
    if (!creation) {
      return [];
    }
    const chosenClass = creation.classes.find((entry) => entry.id === classId);
    return creation.races.filter((race) => {
      if (chosenClass?.allowedRaceIds && !chosenClass.allowedRaceIds.includes(race.id)) {
        return false;
      }
      if (race.allowedClassIds && classId && !race.allowedClassIds.includes(classId)) {
        return false;
      }
      return true;
    });
  }, [creation, classId]);

  const availableClasses = useMemo(() => {
    if (!creation) {
      return [];
    }
    const chosenRace = creation.races.find((entry) => entry.id === raceId);
    return creation.classes.filter((entry) => {
      if (chosenRace?.allowedClassIds && !chosenRace.allowedClassIds.includes(entry.id)) {
        return false;
      }
      if (entry.allowedRaceIds && raceId && !entry.allowedRaceIds.includes(raceId)) {
        return false;
      }
      return true;
    });
  }, [creation, raceId]);

  const chosenRace = creation?.races.find((entry) => entry.id === raceId);

  const nameValid =
    !creation ||
    (!creation.name.required && name.trim().length === 0) ||
    (name.trim().length >= creation.name.minLength && name.trim().length <= creation.name.maxLength);

  const requiredAppearanceMissing = (creation?.appearanceFields ?? []).some(
    (field) => field.required && !appearance[field.id] && field.default === undefined,
  );

  const pointBuy = creation?.attributes.method === 'pointBuy';
  const ready =
    Boolean(creation) &&
    nameValid &&
    Boolean(classId || (creation?.classes.length ?? 0) === 1) &&
    Boolean(raceId || (creation?.races.length ?? 0) === 1) &&
    (!pointBuy || remaining === 0) &&
    !requiredAppearanceMissing;

  const adjust = (attributeId: string, delta: number) => {
    if (!creation) {
      return;
    }
    const definition = creation.attributes.definitions.find((entry) => entry.id === attributeId);
    if (!definition) {
      return;
    }
    const floor = attributeFloor(creation, definition.min);
    const ceiling = attributeCeiling(creation, definition.max);
    const current = currentAttributes[attributeId] ?? floor;
    const next = current + delta;

    if (next < floor || next > ceiling) {
      return;
    }
    if (delta > 0 && remaining <= 0) {
      return;
    }
    setAttributes((previous) => ({ ...previous, [attributeId]: next }));
  };

  const begin = () => {
    if (!data || !creation) {
      return;
    }
    const resolvedClassId = classId ?? creation.classes[0]?.id;
    const resolvedRaceId = raceId ?? creation.races[0]?.id;

    const appearanceWithDefaults: Record<string, string | number | boolean | null> = {};
    for (const field of creation.appearanceFields) {
      const value = appearance[field.id] ?? field.default;
      if (value !== undefined && value !== null && value !== '') {
        appearanceWithDefaults[field.id] = value;
      }
    }

    startSession.mutate(
      {
        adventure: data.slug,
        character: {
          name: name.trim() || 'Andarilho',
          ...(resolvedClassId ? { classId: resolvedClassId } : {}),
          ...(resolvedRaceId ? { raceId: resolvedRaceId } : {}),
          ...(creation.attributes.method === 'pointBuy' ? { attributes: currentAttributes } : {}),
          appearance: appearanceWithDefaults,
          ...(description.trim() ? { description: description.trim() } : {}),
        },
      },
      {
        onSuccess: (session) => navigate(`/jogar/${session.sessionId}`),
      },
    );
  };

  if (isLoading) {
    return <LoadingBlock label="Abrindo a aventura…" />;
  }
  if (error) {
    return (
      <ErrorNotice
        message={error instanceof Error ? error.message : 'Falha ao carregar a aventura.'}
        onRetry={() => void refetch()}
      />
    );
  }
  if (!data || !creation) {
    return <ErrorNotice message="Aventura não encontrada." />;
  }

  return (
    <div className="space-y-6">
      <header>
        <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate('/aventuras')}>
          ← Catálogo
        </Button>
        <h1 className="font-display text-2xl text-parchment-50 sm:text-3xl">{data.title}</h1>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone="gold">v{data.version}</Badge>
          <Badge tone="arcane">{data.ruleset.name}</Badge>
          {data.world && <Badge>{data.world}</Badge>}
          {data.ageRating && <Badge>{data.ageRating}</Badge>}
          {!data.ruleset.combatEnabled && <Badge tone="moss">sem combate</Badge>}
        </div>
      </header>

      {data.description && (
        <Panel>
          <Narrative text={data.description} />
          {data.contentWarnings.length > 0 && (
            <p className="mt-4 font-ui text-[12px] text-parchment-400">
              Conteúdo sensível: {data.contentWarnings.join(', ')}.
            </p>
          )}
        </Panel>
      )}

      {!authenticated ? (
        <Panel>
          <p className="font-ui text-sm text-parchment-200">
            Entre para criar seu personagem e começar esta aventura.
          </p>
          <Button variant="primary" className="mt-3" onClick={() => navigate('/entrar')}>
            Entrar
          </Button>
        </Panel>
      ) : (
        <>
          <h2 className="font-display text-xl text-parchment-50">Crie seu personagem</h2>
          {creation.intro && <p className="font-ui text-sm text-parchment-300">{creation.intro}</p>}

          {startSession.error && (
            <ErrorNotice
              title="Não foi possível começar"
              message={
                startSession.error instanceof ApiError
                  ? startSession.error.message
                  : 'Falha ao iniciar a partida.'
              }
            />
          )}

          <Panel>
            <PanelTitle>Identidade</PanelTitle>
            <label htmlFor="char-name" className="mb-1 block font-ui text-xs text-parchment-300">
              Nome
            </label>
            <input
              id="char-name"
              type="text"
              value={name}
              maxLength={creation.name.maxLength}
              onChange={(event) => setName(event.target.value)}
              placeholder={creation.name.suggestions[0] ?? 'Seu nome na lenda'}
              className="w-full rounded-lg border border-night-700 bg-night-900/70 px-3 py-2.5 font-ui text-sm text-parchment-50 focus:border-ember-500 focus:outline-none"
            />
            {creation.name.suggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {creation.name.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setName(suggestion)}
                    className="rounded-full border border-night-700 px-2.5 py-1 font-ui text-[12px] text-parchment-300 hover:border-ember-600/60 hover:text-ember-300"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            {!nameValid && (
              <p className="mt-1 font-ui text-[12px] text-blood-400">
                O nome deve ter entre {creation.name.minLength} e {creation.name.maxLength}{' '}
                caracteres.
              </p>
            )}
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel>
              <PanelTitle
                hint={availableClasses.length === 1 ? 'única opção desta história' : undefined}
              >
                Classe
              </PanelTitle>
              <div className="space-y-2">
                {availableClasses.map((entry) => {
                  const selected = classId === entry.id || availableClasses.length === 1;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setClassId(entry.id)}
                      aria-pressed={selected}
                      className={cx(
                        'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
                        selected
                          ? 'border-ember-500 bg-ember-700/15'
                          : 'border-night-700 bg-night-800/40 hover:border-bronze-600',
                      )}
                    >
                      <span className="block font-body text-sm text-parchment-50">{entry.name}</span>
                      {entry.description && (
                        <span className="mt-0.5 block font-ui text-[12px] text-parchment-400">
                          {entry.description}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </Panel>

            <Panel>
              <PanelTitle hint={availableRaces.length === 1 ? 'única opção desta história' : undefined}>
                Espécie
              </PanelTitle>
              <div className="space-y-2">
                {availableRaces.map((entry) => {
                  const selected = raceId === entry.id || availableRaces.length === 1;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setRaceId(entry.id)}
                      aria-pressed={selected}
                      className={cx(
                        'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
                        selected
                          ? 'border-ember-500 bg-ember-700/15'
                          : 'border-night-700 bg-night-800/40 hover:border-bronze-600',
                      )}
                    >
                      <span className="block font-body text-sm text-parchment-50">{entry.name}</span>
                      {entry.description && (
                        <span className="mt-0.5 block font-ui text-[12px] text-parchment-400">
                          {entry.description}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </Panel>
          </div>

          {pointBuy && (
            <Panel>
              <PanelTitle
                hint={
                  <span className={remaining === 0 ? 'text-moss-400' : 'text-ember-300'}>
                    {remaining} ponto{remaining === 1 ? '' : 's'} restante
                    {remaining === 1 ? '' : 's'}
                  </span>
                }
              >
                Atributos
              </PanelTitle>

              <ul className="space-y-2">
                {creation.attributes.definitions.map((definition) => {
                  const floor = attributeFloor(creation, definition.min);
                  const ceiling = attributeCeiling(creation, definition.max);
                  const value = currentAttributes[definition.id] ?? floor;
                  return (
                    <li
                      key={definition.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-night-800/40 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <span className="block font-body text-sm text-parchment-50">
                          {definition.name}
                        </span>
                        {definition.description && (
                          <span className="block font-ui text-[12px] text-parchment-400">
                            {definition.description}
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={`Diminuir ${definition.name}`}
                          disabled={value <= floor}
                          onClick={() => adjust(definition.id, -1)}
                        >
                          −
                        </Button>
                        <span className="w-7 text-center font-display text-base tabular-nums text-parchment-50">
                          {value}
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={`Aumentar ${definition.name}`}
                          disabled={value >= ceiling || remaining <= 0}
                          onClick={() => adjust(definition.id, 1)}
                        >
                          +
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 font-ui text-[12px] text-parchment-400">
                Modificadores de classe e espécie entram depois, sobre estes valores.
              </p>
            </Panel>
          )}

          {creation.attributes.method === 'roll' && (
            <Panel>
              <PanelTitle>Atributos</PanelTitle>
              <p className="font-ui text-sm text-parchment-300">
                Esta aventura sorteia os atributos ({creation.attributes.rollDice}). A rolagem
                acontece no servidor quando a partida começa.
              </p>
            </Panel>
          )}

          {creation.appearanceFields.length > 0 && (
            <Panel>
              <PanelTitle>Aparência</PanelTitle>
              <div className="space-y-4">
                {creation.appearanceFields.map((field) => (
                  <AppearanceControl
                    key={field.id}
                    field={field}
                    value={appearance[field.id] ?? field.default}
                    allowedOptionIds={chosenRace?.appearanceRestrictions?.[field.id] ?? null}
                    onChange={(value) =>
                      setAppearance((previous) => ({ ...previous, [field.id]: value }))
                    }
                  />
                ))}
              </div>
            </Panel>
          )}

          {creation.allowDescription && (
            <Panel>
              <PanelTitle hint={`${description.length}/${creation.descriptionMaxLength}`}>
                Quem é você?
              </PanelTitle>
              <textarea
                value={description}
                maxLength={creation.descriptionMaxLength}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Uma cicatriz, um juramento, uma dívida antiga…"
                className="w-full resize-y rounded-lg border border-night-700 bg-night-900/70 px-3 py-2.5 font-body text-sm text-parchment-50 focus:border-ember-500 focus:outline-none"
              />
            </Panel>
          )}

          <div className="sticky bottom-4 z-30">
            <Button
              variant="primary"
              size="lg"
              block
              disabled={!ready}
              loading={startSession.isPending}
              onClick={begin}
            >
              {ready
                ? 'Começar a aventura'
                : pointBuy && remaining !== 0
                  ? `Distribua os ${creation.attributes.points} pontos`
                  : 'Complete a ficha para começar'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
