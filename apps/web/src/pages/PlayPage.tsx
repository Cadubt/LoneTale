import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { CharacterPanel } from '../components/player/CharacterPanel';
import { ChoiceList } from '../components/player/ChoiceList';
import { CombatPanel } from '../components/player/CombatPanel';
import { EventFeed } from '../components/player/EventFeed';
import { InventoryPanel } from '../components/player/InventoryPanel';
import { MerchantPanel } from '../components/player/MerchantPanel';
import { SkillCheckPanel } from '../components/player/SkillCheckPanel';
import {
  Badge,
  Button,
  ErrorNotice,
  LoadingBlock,
  Narrative,
  Panel,
  PanelTitle,
  cx,
} from '../components/ui';
import { ApiError } from '../lib/api-client';
import { useSessionAction, useSessionState, type PlayerActionInput } from '../lib/queries';

type MobileTab = 'historia' | 'ficha' | 'mochila';

const ENDING_TONES: Record<string, 'moss' | 'blood' | 'arcane' | 'ember'> = {
  victory: 'moss',
  defeat: 'blood',
  secret: 'arcane',
  neutral: 'ember',
};

export function PlayPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useSessionState(sessionId);
  const action = useSessionAction(sessionId ?? '');
  const [pendingChoiceId, setPendingChoiceId] = useState<string | null>(null);
  const [tab, setTab] = useState<MobileTab>('historia');

  const view = data?.view;

  const send = (input: Omit<PlayerActionInput, 'expectedSequence'>) => {
    if (!view) {
      return;
    }
    action.mutate(
      { ...input, expectedSequence: view.sequence },
      { onSettled: () => setPendingChoiceId(null) },
    );
  };

  if (isLoading) {
    return <LoadingBlock label="Retomando sua aventura…" />;
  }
  if (error) {
    return (
      <ErrorNotice
        message={error instanceof Error ? error.message : 'Falha ao carregar a partida.'}
        onRetry={() => void refetch()}
      />
    );
  }
  if (!view || !sessionId) {
    return <ErrorNotice message="Partida não encontrada." />;
  }

  const busy = action.isPending;
  const finished = view.status !== 'active';
  const inCombat = Boolean(view.combat);
  const canAct = view.availableActions;

  const storyColumn = (
    <div className="space-y-4">
      {view.node.image?.src && (
        <figure className="overflow-hidden rounded-xl border border-ink-800">
          <img
            src={view.node.image.src}
            alt={view.node.image.alt ?? ''}
            className="aspect-[16/9] w-full object-cover"
            onError={(event) => {
              event.currentTarget.closest('figure')?.remove();
            }}
          />
        </figure>
      )}

      <Panel>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {view.node.title && (
            <h1 className="mr-auto font-display text-xl text-ink-50">{view.node.title}</h1>
          )}
          {view.node.checkpoint && <Badge tone="moss">ponto seguro</Badge>}
          <Badge>{view.node.type}</Badge>
        </div>

        {view.node.text && <Narrative text={view.node.text} />}

        {view.dialogue && view.dialogue.length > 0 && (
          <ul className="mt-4 space-y-3 border-l-2 border-ember-700/40 pl-4">
            {view.dialogue.map((line, index) => (
              <li key={index}>
                {line.speakerName && (
                  <span className="block font-display text-[13px] uppercase tracking-wide text-ember-300">
                    {line.speakerName}
                  </span>
                )}
                <p className="lt-prose italic">{line.text}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {view.ending && (
        <Panel
          className={cx(
            'border-2',
            view.ending.kind === 'defeat' ? 'border-blood-600/50' : 'border-ember-600/50',
          )}
        >
          <div className="mb-2 flex items-center gap-2">
            <Badge tone={ENDING_TONES[view.ending.kind ?? 'neutral'] ?? 'ember'}>
              {view.ending.kind === 'defeat'
                ? 'derrota'
                : view.ending.kind === 'secret'
                  ? 'final secreto'
                  : view.ending.kind === 'victory'
                    ? 'vitória'
                    : 'final'}
            </Badge>
          </div>
          <h2 className="font-display text-xl text-ink-50">{view.ending.title}</h2>
          {view.ending.text && (
            <div className="mt-2">
              <Narrative text={view.ending.text} />
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => navigate('/')}>
              Escolher outra lenda
            </Button>
            <Button variant="ghost" onClick={() => navigate('/partidas')}>
              Minhas partidas
            </Button>
          </div>
        </Panel>
      )}

      {action.error && (
        <ErrorNotice
          title={
            action.error instanceof ApiError && action.error.isStaleState
              ? 'Estado desatualizado'
              : 'Ação recusada'
          }
          message={
            action.error instanceof ApiError
              ? action.error.isStaleState
                ? `${action.error.message} O estado foi recarregado.`
                : action.error.message
              : 'Falha ao enviar a ação.'
          }
        />
      )}

      {view.skillCheck && !finished && (
        <SkillCheckPanel
          check={view.skillCheck}
          busy={busy}
          onRoll={() => send({ type: 'rollSkillCheck' })}
        />
      )}

      {view.combat && (
        <CombatPanel
          combat={view.combat}
          busy={busy}
          onAttack={(targetInstanceId) =>
            send({
              type: 'combatAttack',
              ...(targetInstanceId ? { targetInstanceId } : {}),
            })
          }
          onSkill={(skillId, targetInstanceId) =>
            send({
              type: 'combatSkill',
              skillId,
              ...(targetInstanceId ? { targetInstanceId } : {}),
            })
          }
          onItem={(itemId) => send({ type: 'combatItem', itemId })}
          onFlee={() => send({ type: 'combatFlee' })}
        />
      )}

      {view.merchant && !inCombat && !finished && (
        <MerchantPanel
          merchant={view.merchant}
          gold={view.character.gold}
          busy={busy}
          onBuy={(itemId) => send({ type: 'buyItem', itemId, quantity: 1 })}
          onSell={(itemId) => send({ type: 'sellItem', itemId, quantity: 1 })}
        />
      )}

      {!finished && !inCombat && view.choices.length > 0 && (
        <Panel>
          <PanelTitle>O que você faz?</PanelTitle>
          <ChoiceList
            choices={view.choices}
            pendingChoiceId={pendingChoiceId}
            disabled={busy}
            onChoose={(choiceId) => {
              setPendingChoiceId(choiceId);
              send({ type: 'choose', nodeId: view.node.id, choiceId });
            }}
          />
        </Panel>
      )}

      {!finished && !inCombat && canAct.includes('continue') && (
        <Button variant="primary" size="lg" block loading={busy} onClick={() => send({ type: 'continue' })}>
          Continuar
        </Button>
      )}

      {canAct.includes('restoreCheckpoint') && finished && (
        <Button variant="secondary" block loading={busy} onClick={() => send({ type: 'restoreCheckpoint' })}>
          Retomar do último ponto seguro
        </Button>
      )}

      {data?.events && data.events.length > 0 && <EventFeed events={data.events} />}
    </div>
  );

  const sheetColumn = (
    <CharacterPanel
      character={view.character}
      quests={view.quests}
      variables={view.variables}
      allocating={busy}
      {...(canAct.includes('allocateAttribute')
        ? {
            onAllocate: (attributeId: string) =>
              send({ type: 'allocateAttribute', attributeId, points: 1 }),
          }
        : {})}
    />
  );

  const inventoryColumn = (
    <InventoryPanel
      items={view.inventory}
      busy={busy}
      actionsEnabled={!finished && !inCombat}
      onUse={(itemId) => send({ type: 'useItem', itemId })}
      onEquip={(itemId) => send({ type: 'equipItem', itemId })}
      onUnequip={(slot) => send({ type: 'unequipItem', slot })}
    />
  );

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/partidas')}>
          ← Partidas
        </Button>
        <span className="ml-auto font-ui text-[11px] text-ink-500">
          {view.adventure.title} · v{view.adventure.version} · passo {view.sequence}
        </span>
      </div>

      {/* Celular: abas. Desktop: três colunas visíveis ao mesmo tempo. */}
      <div className="mb-4 flex gap-1 lg:hidden" role="tablist" aria-label="Seções da partida">
        {(
          [
            ['historia', 'História'],
            ['ficha', 'Ficha'],
            ['mochila', 'Mochila'],
          ] as Array<[MobileTab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cx(
              'min-h-[40px] flex-1 rounded-lg font-ui text-sm transition-colors',
              tab === key ? 'bg-ink-800 text-ember-300' : 'text-ink-300 hover:bg-ink-800/50',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className={cx(tab === 'historia' ? 'block' : 'hidden', 'lg:block')}>{storyColumn}</div>
        <aside className="space-y-4">
          <div className={cx(tab === 'ficha' ? 'block' : 'hidden', 'lg:block')}>{sheetColumn}</div>
          <div className={cx(tab === 'mochila' ? 'block' : 'hidden', 'lg:block')}>
            {inventoryColumn}
          </div>
        </aside>
      </div>
    </div>
  );
}
