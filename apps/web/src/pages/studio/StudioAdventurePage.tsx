import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  Badge,
  Button,
  ErrorNotice,
  LoadingBlock,
  Panel,
  PanelTitle,
  cx,
} from '../../components/ui';
import { ApiError } from '../../lib/api-client';
import {
  NODE_TYPE_COLORS,
  NODE_TYPE_LABELS,
  buildAdventureGraph,
  type GraphNodeData,
} from '../../lib/adventure-graph';
import { usePublishAdventure, useStudioAdventure, useStudioDocument } from '../../lib/queries';

/** No do grafo, com cor por tipo e indicadores de autoria. */
function AdventureFlowNode({ data, selected }: NodeProps) {
  const node = data as GraphNodeData;
  const color = NODE_TYPE_COLORS[node.nodeType] ?? '#5f4f38';

  return (
    <div
      className={cx(
        'w-48 rounded-lg border-2 bg-ink-900/95 px-3 py-2 shadow-panel',
        selected ? 'border-ember-400' : 'border-transparent',
      )}
      style={{ borderLeftColor: color, borderLeftWidth: 4 }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-start justify-between gap-1.5">
        <span className="line-clamp-2 font-display text-[12px] leading-snug text-ink-50">
          {node.label}
        </span>
        {node.checkpoint && (
          <span aria-label="ponto seguro" title="ponto seguro" className="text-moss-400">
            ◆
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-2 font-ui text-[10px] text-ink-400">
        <span style={{ color }}>{NODE_TYPE_LABELS[node.nodeType] ?? node.nodeType}</span>
        {node.choiceCount > 0 && <span>{node.choiceCount} escolha(s)</span>}
        {!node.hasText && node.nodeType !== 'checkpoint' && (
          <span className="text-blood-400" title="sem texto narrativo">
            sem texto
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { adventureNode: AdventureFlowNode };

export function StudioAdventurePage() {
  const { adventureId } = useParams<{ adventureId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useStudioAdventure(adventureId);
  const publish = usePublishAdventure(adventureId ?? '');

  const [visibility, setVisibility] = useState('public');
  const [releaseNotes, setReleaseNotes] = useState('');

  const selectedVersionId =
    data?.adventure.draftVersionId ?? data?.adventure.currentVersionId ?? undefined;

  const document = useStudioDocument(adventureId, selectedVersionId);
  const graph = useMemo(() => buildAdventureGraph(document.data), [document.data]);

  if (isLoading) {
    return <LoadingBlock />;
  }
  if (error) {
    return (
      <ErrorNotice
        message={error instanceof Error ? error.message : 'Falha ao carregar a aventura.'}
        onRetry={() => void refetch()}
      />
    );
  }
  if (!data) {
    return <ErrorNotice message="Aventura não encontrada." />;
  }

  const draft = data.versions.find((version) => version.id === data.adventure.draftVersionId);
  const published = data.versions.find((version) => version.id === data.adventure.currentVersionId);

  return (
    <div className="space-y-5">
      <header>
        <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate('/studio')}>
          ← Studio
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto font-display text-2xl text-ink-50">{data.adventure.title}</h1>
          {published && <Badge tone="moss">v{published.version} no ar</Badge>}
          {draft && <Badge tone="ember">v{draft.version} em edição</Badge>}
        </div>
        <p className="font-ui text-[12px] text-ink-400">{data.adventure.slug}</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel className="p-0">
          <div className="flex items-center justify-between gap-2 border-b border-ink-800 px-4 py-3">
            <h2 className="font-display text-sm uppercase tracking-[0.18em] text-ember-300">
              Mapa da história
            </h2>
            <span className="font-ui text-[11px] text-ink-400">
              {graph.nodes.length} nós · {graph.edges.length} ligações
            </span>
          </div>

          <div className="h-[520px] w-full">
            {document.isLoading ? (
              <LoadingBlock label="Carregando o documento…" />
            ) : graph.nodes.length === 0 ? (
              <div className="grid h-full place-items-center px-6 text-center">
                <p className="font-ui text-sm text-ink-400">
                  Nenhum nó para desenhar. Grave um rascunho com nós para ver o mapa.
                </p>
              </div>
            ) : (
              <ReactFlow
                nodes={graph.nodes}
                edges={graph.edges}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.2}
                maxZoom={1.5}
                proOptions={{ hideAttribution: true }}
                colorMode="dark"
              >
                <Background color="#2b251b" gap={20} />
                <Controls showInteractive={false} />
                <MiniMap
                  pannable
                  zoomable
                  nodeColor={(node) =>
                    NODE_TYPE_COLORS[(node.data as GraphNodeData).nodeType] ?? '#5f4f38'
                  }
                  maskColor="rgba(15,13,9,0.7)"
                />
              </ReactFlow>
            )}
          </div>

          {graph.danglingTargets.length > 0 && (
            <div className="border-t border-blood-600/40 bg-blood-600/10 px-4 py-3">
              <h3 className="font-display text-xs uppercase tracking-[0.18em] text-blood-400">
                Alvos inexistentes
              </h3>
              <ul className="mt-1 space-y-0.5">
                {graph.danglingTargets.slice(0, 8).map((entry, index) => (
                  <li key={index} className="font-ui text-[12px] text-ink-200">
                    <code className="text-ink-400">{entry.from}</code> aponta para{' '}
                    <code className="text-blood-400">{entry.to}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelTitle>Legenda</PanelTitle>
            <ul className="space-y-1.5">
              {Object.entries(NODE_TYPE_LABELS).map(([type, label]) => (
                <li key={type} className="flex items-center gap-2 font-ui text-[12px] text-ink-300">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded"
                    style={{ backgroundColor: NODE_TYPE_COLORS[type] }}
                  />
                  {label}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelTitle>Versões</PanelTitle>
            <ul className="space-y-2">
              {data.versions.map((version) => (
                <li
                  key={version.id}
                  className="rounded-lg border border-ink-800 bg-ink-800/40 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-sm text-ink-50">v{version.version}</span>
                    <Badge
                      tone={
                        version.status === 'published'
                          ? 'moss'
                          : version.status === 'deprecated'
                            ? 'neutral'
                            : 'ember'
                      }
                    >
                      {version.status === 'published'
                        ? 'publicada'
                        : version.status === 'deprecated'
                          ? 'substituída'
                          : 'rascunho'}
                    </Badge>
                  </div>
                  <p className="font-ui text-[11px] text-ink-400">
                    {version.nodeCount} nós · contrato {version.schemaVersion}
                  </p>
                  {version.publishedAt && (
                    <p className="font-ui text-[11px] text-ink-500">
                      publicada em{' '}
                      {new Date(version.publishedAt).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Panel>

          {draft ? (
            <Panel>
              <PanelTitle>Publicar v{draft.version}</PanelTitle>
              <p className="mb-3 font-ui text-[12px] text-ink-400">
                Depois de publicada, a versão não muda mais. Partidas em andamento continuam na
                versão em que começaram.
              </p>

              <label htmlFor="visibility" className="mb-1 block font-ui text-xs text-ink-300">
                Visibilidade
              </label>
              <select
                id="visibility"
                value={visibility}
                onChange={(event) => setVisibility(event.target.value)}
                className="mb-3 w-full rounded-lg border border-ink-700 bg-ink-900/70 px-3 py-2.5 font-ui text-sm text-ink-50 focus:border-ember-500 focus:outline-none"
              >
                <option value="public">Pública (aparece no catálogo)</option>
                <option value="unlisted">Não listada (só por link)</option>
                <option value="private">Privada (só você)</option>
              </select>

              <label htmlFor="notes" className="mb-1 block font-ui text-xs text-ink-300">
                Notas da versão
              </label>
              <textarea
                id="notes"
                value={releaseNotes}
                onChange={(event) => setReleaseNotes(event.target.value)}
                rows={3}
                maxLength={1000}
                className="mb-3 w-full resize-y rounded-lg border border-ink-700 bg-ink-900/70 px-3 py-2.5 font-ui text-[13px] text-ink-50 focus:border-ember-500 focus:outline-none"
              />

              {publish.error && (
                <div className="mb-3">
                  <ErrorNotice
                    title="Não foi possível publicar"
                    message={
                      publish.error instanceof ApiError ? publish.error.message : 'Erro inesperado.'
                    }
                  />
                </div>
              )}

              <Button
                variant="primary"
                block
                loading={publish.isPending}
                onClick={() =>
                  publish.mutate({
                    visibility,
                    ...(releaseNotes.trim() ? { releaseNotes: releaseNotes.trim() } : {}),
                  })
                }
              >
                Publicar
              </Button>
            </Panel>
          ) : (
            <Panel>
              <PanelTitle>Sem rascunho aberto</PanelTitle>
              <p className="font-ui text-[13px] text-ink-300">
                A versão publicada é imutável. Para continuar editando, abra uma nova versão pela
                API (<code className="text-ink-400">POST /api/adventures/:id/versions</code>) — a
                interface de edição de nós é o próximo passo do Studio.
              </p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
