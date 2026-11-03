import type { AdventureDocument, AdventureNode, Choice } from '../types/adventure';
import type { Condition } from '../types/conditions';
import type { EffectEntry } from '../types/effects';

export interface Visitor {
  condition?(condition: Condition, path: string): void;
  effect?(effect: EffectEntry, path: string): void;
  choice?(choice: Choice, path: string): void;
  node?(node: AdventureNode, path: string): void;
}

/** Percorre recursivamente uma condicao e suas sub-condicoes. */
export function walkCondition(
  condition: Condition | undefined,
  path: string,
  visitor: Visitor,
): void {
  if (!condition) {
    return;
  }
  visitor.condition?.(condition, path);
  switch (condition.type) {
    case 'all':
    case 'any':
      condition.conditions.forEach((child, index) => {
        walkCondition(child, `${path}.conditions[${index}]`, visitor);
      });
      break;
    case 'not':
      walkCondition(condition.condition, `${path}.condition`, visitor);
      break;
    default:
      break;
  }
}

/** Percorre uma lista de efeitos, descendo em `when` e em tabelas aleatorias. */
export function walkEffects(
  effects: EffectEntry[] | undefined,
  path: string,
  visitor: Visitor,
): void {
  if (!effects) {
    return;
  }
  effects.forEach((effect, index) => {
    const effectPath = `${path}[${index}]`;
    visitor.effect?.(effect, effectPath);
    walkCondition(effect.when, `${effectPath}.when`, visitor);
    if (effect.type === 'rollTable') {
      effect.outcomes.forEach((outcome, outcomeIndex) => {
        walkEffects(outcome.effects, `${effectPath}.outcomes[${outcomeIndex}].effects`, visitor);
      });
    }
  });
}

function walkChoice(choice: Choice, path: string, visitor: Visitor): void {
  visitor.choice?.(choice, path);
  walkCondition(choice.conditions, `${path}.conditions`, visitor);
  walkEffects(choice.cost, `${path}.cost`, visitor);
  walkEffects(choice.effects, `${path}.effects`, visitor);
  if (choice.target?.kind === 'conditional') {
    choice.target.branches.forEach((branch, index) => {
      walkCondition(branch.when, `${path}.target.branches[${index}].when`, visitor);
    });
  }
}

/** Percorre todo o documento, visitando nos, escolhas, condicoes e efeitos. */
export function walkAdventure(doc: AdventureDocument, visitor: Visitor): void {
  doc.nodes.forEach((node, nodeIndex) => {
    const nodePath = `nodes[${nodeIndex}]`;
    visitor.node?.(node, nodePath);
    walkCondition(node.entryConditions, `${nodePath}.entryConditions`, visitor);
    walkEffects(node.onEnter, `${nodePath}.onEnter`, visitor);
    walkEffects(node.onExit, `${nodePath}.onExit`, visitor);
    node.choices?.forEach((choice, choiceIndex) => {
      walkChoice(choice, `${nodePath}.choices[${choiceIndex}]`, visitor);
    });

    switch (node.type) {
      case 'dialogue':
        node.lines.forEach((line, lineIndex) => {
          walkCondition(line.when, `${nodePath}.lines[${lineIndex}].when`, visitor);
        });
        break;
      case 'combat':
        walkEffects(node.encounter.onVictoryEffects, `${nodePath}.encounter.onVictoryEffects`, visitor);
        walkEffects(node.encounter.onDefeatEffects, `${nodePath}.encounter.onDefeatEffects`, visitor);
        break;
      case 'merchant':
        node.stock.forEach((entry, entryIndex) => {
          walkCondition(entry.when, `${nodePath}.stock[${entryIndex}].when`, visitor);
        });
        break;
      case 'discovery':
        walkEffects(node.rewards, `${nodePath}.rewards`, visitor);
        break;
      case 'event':
        node.outcomes?.forEach((outcome, outcomeIndex) => {
          walkEffects(outcome.effects, `${nodePath}.outcomes[${outcomeIndex}].effects`, visitor);
        });
        break;
      case 'skillCheck':
        walkEffects(node.check.onSuccessEffects, `${nodePath}.check.onSuccessEffects`, visitor);
        walkEffects(node.check.onFailureEffects, `${nodePath}.check.onFailureEffects`, visitor);
        break;
      default:
        break;
    }
  });

  doc.skills?.forEach((skill, index) => {
    walkCondition(skill.requirements, `skills[${index}].requirements`, visitor);
    walkEffects(skill.effects, `skills[${index}].effects`, visitor);
  });

  doc.items?.forEach((item, index) => {
    walkCondition(item.requirements, `items[${index}].requirements`, visitor);
    walkEffects(item.useEffects, `items[${index}].useEffects`, visitor);
  });

  doc.enemies?.forEach((enemy, index) => {
    enemy.abilities?.forEach((ability, abilityIndex) => {
      walkEffects(
        ability.applyEffects,
        `enemies[${index}].abilities[${abilityIndex}].applyEffects`,
        visitor,
      );
    });
  });

  doc.quests?.forEach((quest, index) => {
    walkEffects(quest.rewards, `quests[${index}].rewards`, visitor);
  });

  doc.endings.forEach((ending, index) => {
    walkEffects(ending.effects, `endings[${index}].effects`, visitor);
  });
}

/** Alvos de no alcancaveis a partir de um no, usado para reachability. */
export function outgoingNodeIds(node: AdventureNode): string[] {
  const targets: string[] = [];
  const push = (id: string | undefined): void => {
    if (id) {
      targets.push(id);
    }
  };

  push(node.fallbackNodeId);

  for (const choice of node.choices ?? []) {
    const target = choice.target;
    if (!target) {
      continue;
    }
    if (target.kind === 'node') {
      push(target.nodeId);
    } else if (target.kind === 'random') {
      target.options.forEach((option) => push(option.nodeId));
    } else if (target.kind === 'conditional') {
      target.branches.forEach((branch) => push(branch.nodeId));
      push(target.otherwiseNodeId);
    }
    for (const effect of [...(choice.effects ?? []), ...(choice.cost ?? [])]) {
      collectEffectNodeTargets(effect, push);
    }
  }

  for (const effect of [...(node.onEnter ?? []), ...(node.onExit ?? [])]) {
    collectEffectNodeTargets(effect, push);
  }

  switch (node.type) {
    case 'combat':
      push(node.encounter.onVictoryNodeId);
      push(node.encounter.onDefeatNodeId);
      push(node.encounter.onFleeNodeId);
      break;
    case 'merchant':
      push(node.leaveNodeId);
      break;
    case 'discovery':
      push(node.continueNodeId);
      node.rewards?.forEach((effect) => collectEffectNodeTargets(effect, push));
      break;
    case 'event':
      push(node.continueNodeId);
      node.outcomes?.forEach((outcome) => {
        push(outcome.nodeId);
        outcome.effects?.forEach((effect) => collectEffectNodeTargets(effect, push));
      });
      break;
    case 'skillCheck':
      push(node.check.onSuccessNodeId);
      push(node.check.onFailureNodeId);
      push(node.check.onCriticalSuccessNodeId);
      push(node.check.onCriticalFailureNodeId);
      break;
    case 'checkpoint':
      push(node.continueNodeId);
      break;
    default:
      break;
  }

  return targets;
}

function collectEffectNodeTargets(effect: EffectEntry, push: (id: string | undefined) => void): void {
  if (effect.type === 'goto') {
    push(effect.nodeId);
  } else if (effect.type === 'startCombat') {
    push(effect.onVictoryNodeId);
    push(effect.onDefeatNodeId);
    push(effect.onFleeNodeId);
  } else if (effect.type === 'rollTable') {
    effect.outcomes.forEach((outcome) => {
      push(outcome.nodeId);
      outcome.effects?.forEach((child) => collectEffectNodeTargets(child, push));
    });
  }
}
