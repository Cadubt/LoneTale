import type { Edge, Node } from '@xyflow/react';

/**
 * Extracao do grafo da aventura para o editor visual.
 *
 * Deliberadamente independente do motor: esta e uma leitura de apresentacao,
 * tolerante a documentos incompletos (um rascunho em edicao costuma ter alvos
 * ainda vazios). Importar o motor aqui traria o validador e o JSON Schema para
 * o bundle do navegador sem necessidade -- a validacao autoritativa acontece no
 * backend.
 */
export interface GraphNodeData extends Record<string, unknown> {
  label: string;
  nodeType: string;
  checkpoint: boolean;
  choiceCount: number;
  hasText: boolean;
}

interface RawVisual {
  position?: { x?: number; y?: number };
  color?: string;
}

interface RawChoice {
  id?: string;
  label?: string;
  target?: Record<string, unknown>;
  effects?: Array<Record<string, unknown>>;
  cost?: Array<Record<string, unknown>>;
}

interface RawNode {
  id?: string;
  type?: string;
  title?: string;
  text?: string;
  checkpoint?: boolean;
  visual?: RawVisual;
  choices?: RawChoice[];
  fallbackNodeId?: string;
  continueNodeId?: string;
  leaveNodeId?: string;
  endingId?: string;
  onEnter?: Array<Record<string, unknown>>;
  encounter?: Record<string, unknown>;
  check?: Record<string, unknown>;
  outcomes?: Array<Record<string, unknown>>;
}

export interface AdventureGraph {
  nodes: Node<GraphNodeData>[];
  edges: Edge[];
  /** Alvos citados que nao correspondem a nenhum no: ajudam o autor. */
  danglingTargets: Array<{ from: string; to: string }>;
}

const EDGE_COLORS: Record<string, string> = {
  choice: '#d2721f',
  success: '#4f9361',
  failure: '#c0392b',
  auto: '#5f4f38',
  combat: '#97291e',
};

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function collectEffectTargets(
  effects: Array<Record<string, unknown>> | undefined,
  push: (target: string | undefined, kind: string, label?: string) => void,
): void {
  for (const effect of effects ?? []) {
    if (effect.type === 'goto') {
      push(asString(effect.nodeId), 'auto', 'ir para');
    }
    if (effect.type === 'startCombat') {
      push(asString(effect.onVictoryNodeId), 'success', 'vitória');
      push(asString(effect.onDefeatNodeId), 'failure', 'derrota');
      push(asString(effect.onFleeNodeId), 'auto', 'fuga');
    }
    if (effect.type === 'rollTable' && Array.isArray(effect.outcomes)) {
      for (const outcome of effect.outcomes as Array<Record<string, unknown>>) {
        push(asString(outcome.nodeId), 'auto', asString(outcome.label) ?? 'sorteio');
        collectEffectTargets(outcome.effects as Array<Record<string, unknown>>, push);
      }
    }
  }
}

/** Layout em grade, usado quando o no nao traz posicao salva pelo editor. */
function fallbackPosition(index: number): { x: number; y: number } {
  const columns = 5;
  return { x: (index % columns) * 280, y: Math.floor(index / columns) * 180 };
}

export function buildAdventureGraph(document: Record<string, unknown> | undefined): AdventureGraph {
  const rawNodes = Array.isArray(document?.nodes) ? (document.nodes as RawNode[]) : [];
  const known = new Set(rawNodes.map((node) => node.id).filter((id): id is string => Boolean(id)));

  const nodes: Node<GraphNodeData>[] = rawNodes
    .filter((node): node is RawNode & { id: string } => Boolean(node.id))
    .map((node, index) => {
      const position =
        typeof node.visual?.position?.x === 'number' && typeof node.visual?.position?.y === 'number'
          ? { x: node.visual.position.x, y: node.visual.position.y }
          : fallbackPosition(index);

      return {
        id: node.id,
        position,
        type: 'adventureNode',
        data: {
          label: node.title ?? node.id,
          nodeType: node.type ?? 'story',
          checkpoint: node.checkpoint === true || node.type === 'checkpoint',
          choiceCount: node.choices?.length ?? 0,
          hasText: Boolean(node.text && node.text.trim().length > 0),
        },
      };
    });

  const edges: Edge[] = [];
  const danglingTargets: Array<{ from: string; to: string }> = [];
  const seen = new Set<string>();

  for (const node of rawNodes) {
    if (!node.id) {
      continue;
    }
    const from = node.id;

    const push = (target: string | undefined, kind: string, label?: string): void => {
      if (!target) {
        return;
      }
      if (!known.has(target)) {
        danglingTargets.push({ from, to: target });
        return;
      }
      const id = `${from}->${target}:${kind}:${label ?? ''}`;
      if (seen.has(id)) {
        return;
      }
      seen.add(id);
      edges.push({
        id,
        source: from,
        target,
        ...(label ? { label } : {}),
        animated: kind === 'combat',
        style: { stroke: EDGE_COLORS[kind] ?? EDGE_COLORS.auto, strokeWidth: 1.5 },
        labelStyle: { fill: '#b6a383', fontSize: 11 },
        labelBgStyle: { fill: '#1a1711', fillOpacity: 0.85 },
      });
    };

    push(node.fallbackNodeId, 'auto', 'fallback');
    push(node.continueNodeId, 'auto', 'continuar');
    push(node.leaveNodeId, 'auto', 'sair');

    for (const choice of node.choices ?? []) {
      const target = choice.target;
      const label = choice.label ?? choice.id;
      if (target?.kind === 'node') {
        push(asString(target.nodeId), 'choice', label);
      } else if (target?.kind === 'random' && Array.isArray(target.options)) {
        for (const option of target.options as Array<Record<string, unknown>>) {
          push(asString(option.nodeId), 'choice', `${label} (sorteio)`);
        }
      } else if (target?.kind === 'conditional' && Array.isArray(target.branches)) {
        for (const branch of target.branches as Array<Record<string, unknown>>) {
          push(asString(branch.nodeId), 'choice', `${label} (condicional)`);
        }
        push(asString(target.otherwiseNodeId), 'choice', `${label} (senão)`);
      }
      collectEffectTargets(choice.effects, push);
      collectEffectTargets(choice.cost, push);
    }

    collectEffectTargets(node.onEnter, push);

    if (node.encounter) {
      push(asString(node.encounter.onVictoryNodeId), 'success', 'vitória');
      push(asString(node.encounter.onDefeatNodeId), 'failure', 'derrota');
      push(asString(node.encounter.onFleeNodeId), 'auto', 'fuga');
    }

    if (node.check) {
      push(asString(node.check.onSuccessNodeId), 'success', 'sucesso');
      push(asString(node.check.onFailureNodeId), 'failure', 'falha');
      push(asString(node.check.onCriticalSuccessNodeId), 'success', 'crítico');
      push(asString(node.check.onCriticalFailureNodeId), 'failure', 'falha crítica');
    }

    for (const outcome of node.outcomes ?? []) {
      push(asString(outcome.nodeId), 'auto', asString(outcome.label) ?? 'resultado');
    }
  }

  return { nodes, edges, danglingTargets };
}

export const NODE_TYPE_COLORS: Record<string, string> = {
  story: '#5f4f38',
  dialogue: '#3a55a8',
  combat: '#97291e',
  merchant: '#b05916',
  discovery: '#3a6f49',
  event: '#6f4fa8',
  skillCheck: '#4a6fd0',
  checkpoint: '#4f9361',
  ending: '#d2721f',
};

export const NODE_TYPE_LABELS: Record<string, string> = {
  story: 'narrativa',
  dialogue: 'diálogo',
  combat: 'combate',
  merchant: 'comércio',
  discovery: 'descoberta',
  event: 'evento',
  skillCheck: 'teste',
  checkpoint: 'ponto seguro',
  ending: 'final',
};
