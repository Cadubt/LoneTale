import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { CharacterRail, CharacterStrip } from '../components/player/CharacterRail';
import { ChoiceList } from '../components/player/ChoiceList';
import { CombatPanel } from '../components/player/CombatPanel';
import { MerchantPanel } from '../components/player/MerchantPanel';
import { NarrationBar } from '../components/player/NarrationBar';
import { SkillCheckPanel } from '../components/player/SkillCheckPanel';
import {
  HistorySection,
  PLAYER_SECTIONS,
  QuestsSection,
  type SectionActions,
} from '../components/player/sections';
import { IconBook, IconChevronDown, IconClock, IconScroll } from '../components/icons';
import { OrnateDivider, OrnateFrame, ParchmentPanel } from '../components/ornate';
import { Badge, Button, ErrorNotice, LoadingBlock, Narrative, cx } from '../components/ui';
import { useNarration } from '../hooks/use-narration';
import { ApiError } from '../lib/api-client';
import {
  useSessionAction,
  useSessionEvents,
  useSessionState,
  type PlayerActionInput,
} from '../lib/queries';
import { useUiStore } from '../store/ui-store';

const ENDING_TONES: Record<string, 'moss' | 'blood' | 'arcane' | 'gold'> = {
  victory: 'moss',
  defeat: 'blood',
  secret: 'arcane',
  neutral: 'gold',
};

const ENDING_LABELS: Record<string, string> = {
  victory: 'vitória',
  defeat: 'derrota',
  secret: 'final secreto',
  neutral: 'final',
};

export function PlayPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useSessionState(sessionId);
  const history = useSessionEvents(sessionId);
  const action = useSessionAction(sessionId ?? '');
  const narration = useNarration();
  const setPendingAttributePoints = useUiStore((state) => state.setPendingAttributePoints);
  const autoPlayNarration = useUiStore((state) => state.narration.autoPlay);

  const [pendingChoiceId, setPendingChoiceId] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string | null>('inventario');
  const [openMobile, setOpenMobile] = useState<string | null>('missoes');

  const view = data?.view;

  // O sino da barra superior mostra o que esta realmente pendente.
  useEffect(() => {
    setPendingAttributePoints(view?.character.pendingAttributePoints ?? 0);
    return () => setPendingAttributePoints(0);
  }, [view?.character.pendingAttributePoints, setPendingAttributePoints]);

  // Narracao automatica: fala o texto sempre que a cena muda.
  const nodeText = view?.node.text ?? '';
  const nodeId = view?.node.id;
  useEffect(() => {
    if (autoPlayNarration && nodeText) {
      narration.speak(nodeText);
    }
    // `narration.speak` e estavel; depender dele reiniciaria a fala a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, autoPlayNarration]);

  // Ao trocar de cena, a fala anterior nao pode continuar.
  useEffect(() => {
    if (!autoPlayNarration) {
      narration.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  const events = useMemo(() => history.data ?? [], [history.data]);

  const send = (input: Omit<PlayerActionInput, 'expectedSequence'>) => {
    if (!view) {
      return;
    }
    action.mutate(
      { ...input, expectedSequence: view.sequence },
      {
        onSettled: () => {
          setPendingChoiceId(null);
          void history.refetch();
        },
      },
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

  const sectionActions: SectionActions = {
    onUse: (itemId) => send({ type: 'useItem', itemId }),
    onEquip: (itemId) => send({ type: 'equipItem', itemId }),
    onUnequip: (slot) => send({ type: 'unequipItem', slot }),
    onAllocate: (attributeId) => send({ type: 'allocateAttribute', attributeId, points: 1 }),
    busy,
    interactive: !finished && !inCombat,
  };

  const chapterLabel = view.node.chapter
    ? `Capítulo ${view.node.chapter.number}${view.node.chapter.title ? `: ${view.node.chapter.title}` : ''}`
    : null;

  // -------------------------------------------------------------- cabecalho
  const banner = (
    <OrnateFrame className="overflow-hidden">
      <div className="banner-strip flex items-center gap-2 px-3 py-2 sm:px-4">
        <IconBook className="h-[18px] w-[18px] shrink-0 text-gold-400" />
        <span className="min-w-0 truncate font-display text-[0.95rem] text-parchment-50">
          LoneTale — {view.adventure.title}
        </span>
        {chapterLabel && (
          <span className="ml-auto hidden shrink-0 font-display text-[0.9rem] text-bronze-200 sm:block">
            {chapterLabel}
          </span>
        )}
      </div>
      {chapterLabel && (
        <p className="banner-strip border-t border-bronze-700/60 px-3 pb-1.5 text-right font-display text-[0.8rem] text-bronze-200 sm:hidden">
          {chapterLabel}
        </p>
      )}
    </OrnateFrame>
  );

  // ------------------------------------------------------------------ cena
  const scene = view.node.image?.src ? (
    <OrnateFrame className="relative overflow-hidden">
      <img
        src={view.node.image.src}
        alt={view.node.image.alt ?? ''}
        className="aspect-[16/9] w-full object-cover"
        onError={(event) => {
          const frame = event.currentTarget.closest('[data-scene]');
          frame?.remove();
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-night-950/80 to-transparent" />
      <NarrationBar
        narration={narration}
        text={nodeText}
        className="absolute bottom-3 right-3 z-10"
      />
    </OrnateFrame>
  ) : (
    nodeText && (
      <div className="flex justify-end">
        <NarrationBar narration={narration} text={nodeText} />
      </div>
    )
  );

  // ------------------------------------------------------------- narrativa
  const story = (
    <ParchmentPanel bodyClassName="px-4 py-5 sm:px-7 sm:py-6">
      {view.node.title && (
        <h1 className="font-display text-2xl text-blood-700 sm:text-[1.75rem]">{view.node.title}</h1>
      )}

      {nodeText && <Narrative text={nodeText} className="mt-3" />}

      {view.dialogue && view.dialogue.length > 0 && (
        <ul className="mt-4 space-y-3 border-l-2 border-bronze-400/60 pl-4">
          {view.dialogue.map((line, index) => (
            <li key={index}>
              {line.speakerName && (
                <span className="block font-display text-[13px] uppercase tracking-wide text-blood-700">
                  {line.speakerName}
                </span>
              )}
              <p className="narrative italic">{line.text}</p>
            </li>
          ))}
        </ul>
      )}

      {!finished && !inCombat && view.choices.length > 0 && (
        <>
          <OrnateDivider className="my-5" />
          <ChoiceList
            choices={view.choices}
            pendingChoiceId={pendingChoiceId}
            disabled={busy}
            onChoose={(choiceId) => {
              setPendingChoiceId(choiceId);
              send({ type: 'choose', nodeId: view.node.id, choiceId });
            }}
          />
        </>
      )}

      {!finished && !inCombat && canAct.includes('continue') && (
        <>
          <OrnateDivider className="my-5" />
          <Button
            variant="primary"
            size="lg"
            block
            loading={busy}
            onClick={() => send({ type: 'continue' })}
          >
            Continuar
          </Button>
        </>
      )}
    </ParchmentPanel>
  );

  // ---------------------------------------------------------------- final
  const ending = view.ending && (
    <ParchmentPanel bodyClassName="px-4 py-5 sm:px-7 sm:py-6">
      <Badge tone={ENDING_TONES[view.ending.kind ?? 'neutral'] ?? 'gold'}>
        {ENDING_LABELS[view.ending.kind ?? 'neutral'] ?? 'final'}
      </Badge>
      <h2 className="mt-2 font-display text-2xl text-blood-700">{view.ending.title}</h2>
      {view.ending.text && <Narrative text={view.ending.text} className="mt-2" />}
      <OrnateDivider className="my-5" />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => navigate('/aventuras')}>
          Escolher outra lenda
        </Button>
        <Button variant="parchment" onClick={() => navigate('/partidas')}>
          Minhas partidas
        </Button>
      </div>
    </ParchmentPanel>
  );

  const alerts = action.error && (
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
  );

  const interactions = (
    <>
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
            send({ type: 'combatAttack', ...(targetInstanceId ? { targetInstanceId } : {}) })
          }
          onSkill={(skillId, targetInstanceId) =>
            send({ type: 'combatSkill', skillId, ...(targetInstanceId ? { targetInstanceId } : {}) })
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

      {canAct.includes('restoreCheckpoint') && finished && (
        <Button variant="secondary" block loading={busy} onClick={() => send({ type: 'restoreCheckpoint' })}>
          Retomar do último ponto seguro
        </Button>
      )}
    </>
  );

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/partidas')}>
          ← Partidas
        </Button>
        <span className="ml-auto font-sans text-[11px] text-bronze-500">
          v{view.adventure.version} · passo {view.sequence}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[288px_minmax(0,1fr)_320px]">
        {/* ------------------------------------------------- trilho esquerdo */}
        <aside className="hidden xl:block">
          <div className="sticky top-[88px]">
            <CharacterRail
              view={view}
              events={events}
              actions={sectionActions}
              openSection={openSection}
              onToggleSection={(id) => setOpenSection((current) => (current === id ? null : id))}
            />
          </div>
        </aside>

        {/* -------------------------------------------------- coluna central */}
        <div className="min-w-0 space-y-4">
          <div className="xl:hidden">
            <CharacterStrip view={view} />
          </div>

          {banner}
          <div data-scene>{scene}</div>
          {alerts}
          {ending}
          {story}
          {interactions}

          {/* ---------------------------------- acordeoes (celular e tablet) */}
          <div className="space-y-2.5 xl:hidden">
            {PLAYER_SECTIONS.map((section) => {
              const Icon = section.icon;
              const open = openMobile === section.id;
              const badge = section.badge?.(view) ?? null;

              return (
                <OrnateFrame key={section.id} className="overflow-hidden">
                  <div className="rail">
                    <button
                      type="button"
                      onClick={() => setOpenMobile((current) => (current === section.id ? null : section.id))}
                      aria-expanded={open}
                      className="tap flex w-full items-center gap-2.5 px-3 text-left text-parchment-100"
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0 text-bronze-300" />
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
                      <div className="animate-fade-up border-t border-bronze-700/60 px-3 py-3">
                        {section.render({ view, actions: sectionActions, events })}
                      </div>
                    )}
                  </div>
                </OrnateFrame>
              );
            })}
          </div>
        </div>

        {/* --------------------------------------------------- trilho direito */}
        <aside className="hidden space-y-4 xl:block">
          <div className="sticky top-[88px] space-y-4">
            <ParchmentPanel bodyClassName="p-4">
              <div className="mb-3 flex items-center gap-2">
                <IconScroll className="h-[18px] w-[18px] text-sepia-600" />
                <h2 className="font-display text-[1.05rem] text-sepia-800">Missões</h2>
              </div>
              <QuestsSection view={view} actions={sectionActions} events={events} tone="parchment" />
            </ParchmentPanel>

            <ParchmentPanel bodyClassName="p-4">
              <div className="mb-3 flex items-center gap-2">
                <IconClock className="h-[18px] w-[18px] text-sepia-600" />
                <h2 className="font-display text-[1.05rem] text-sepia-800">Histórico</h2>
              </div>
              <HistorySection view={view} actions={sectionActions} events={events} tone="parchment" />
            </ParchmentPanel>
          </div>
        </aside>
      </div>
    </div>
  );
}
