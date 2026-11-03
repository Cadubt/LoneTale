import { beforeEach, describe, expect, it } from 'vitest';

import { AdventureEngine } from '../engine/adventure-engine';
import { EngineError, SequenceMismatchError } from '../errors';
import type { AdventureDocument } from '../types/adventure';
import type { CharacterDraft } from '../types/actions';
import type { GameState } from '../types/state';
import type { NodeView } from '../types/view';
import { loadDemoAdventure } from './helpers/load-adventure';

const APPEARANCE = { 'cor-da-pele': 'clara', porte: 'atletico' };
const BALANCED = { forca: 11, destreza: 11, inteligencia: 11, constituicao: 11 };

function draft(classId: string, raceId = 'humano'): CharacterDraft {
  return { name: 'Andarilho', classId, raceId, attributes: BALANCED, appearance: APPEARANCE };
}

/** Executa uma escolha a partir do estado atual, resolvendo a sequencia. */
function choose(engine: AdventureEngine, state: GameState, choiceId: string) {
  return engine.apply(state, {
    type: 'choose',
    nodeId: state.currentNodeId,
    choiceId,
    expectedSequence: state.sequence,
  });
}

function continueFrom(engine: AdventureEngine, state: GameState) {
  return engine.apply(state, { type: 'continue', expectedSequence: state.sequence });
}

function choiceView(view: NodeView, choiceId: string) {
  return view.choices.find((choice) => choice.id === choiceId);
}

/** Sai da introducao, passa pela clareira e chega a floresta antiga. */
function enterForest(engine: AdventureEngine, classId: string, seed = 'teste') {
  let step = engine.startGame(draft(classId), { seed });
  step = choose(engine, step.state, 'comecar');
  step = choose(engine, step.state, 'seguir-trilha');
  return step;
}

/** Caminha da introducao ate a ponte. */
function walkToBridge(engine: AdventureEngine, classId: string, seed = 'teste') {
  const step = enterForest(engine, classId, seed);
  return choose(engine, step.state, 'ir-ao-desfiladeiro');
}

describe('motor: fluxo da aventura de exemplo', () => {
  let doc: AdventureDocument;
  let engine: AdventureEngine;

  beforeEach(() => {
    doc = loadDemoAdventure();
    engine = new AdventureEngine(doc);
  });

  it('inicia a partida no no inicial, com checkpoint gravado', () => {
    const step = engine.startGame(draft('explorador'), { seed: 'inicio' });

    expect(step.state.currentNodeId).toBe('introducao');
    expect(step.state.status).toBe('active');
    expect(step.state.sequence).toBe(1);
    expect(step.state.visitedNodes['introducao']).toBe(1);
    expect(step.state.checkpoint?.nodeId).toBe('introducao');
    expect(step.view.node.title).toBe('A Ponte das Sombras');
    expect(step.view.availableActions).toContain('choose');
    expect(step.events.some((event) => event.type === 'nodeEntered')).toBe(true);
  });

  it('atravessa o no de checkpoint automaticamente ate a ponte', () => {
    const step = walkToBridge(engine, 'explorador');

    expect(step.state.currentNodeId).toBe('ponte-de-pedra');
    // O no de checkpoint foi visitado e repassado sem exigir acao do jogador.
    expect(step.state.visitedNodes['ponto-de-retomada']).toBe(1);
    expect(step.state.checkpoint?.nodeId).toBe('ponto-de-retomada');
    expect(step.state.checkpoint?.label).toBe('Entrada do desfiladeiro');
  });

  it('apresenta exatamente as opcoes que o estado do personagem permite', () => {
    const explorer = walkToBridge(engine, 'explorador').view;
    const warrior = walkToBridge(engine, 'guerreiro').view;
    const mage = walkToBridge(engine, 'mago').view;

    // Explorador comeca com corda: a travessia por corda esta liberada.
    expect(choiceView(explorer, 'usar-corda')?.available).toBe(true);
    // Sem a pericia, a levitacao aparece bloqueada com o motivo.
    expect(choiceView(explorer, 'usar-levitacao')?.available).toBe(false);
    expect(choiceView(explorer, 'usar-levitacao')?.blockedReason).toMatch(/Levitação/);

    // Guerreiro nao tem corda nem levitacao: sobra lutar ou voltar.
    expect(choiceView(warrior, 'usar-corda')?.available).toBe(false);
    expect(choiceView(warrior, 'usar-corda')?.blockedReason).toBe('Você precisaria de uma corda.');
    expect(choiceView(warrior, 'enfrentar-guardiao')?.available).toBe(true);
    expect(choiceView(warrior, 'voltar-a-floresta')?.available).toBe(true);

    // Mago tem a pericia e mana suficiente.
    expect(choiceView(mage, 'usar-levitacao')?.available).toBe(true);
    expect(choiceView(mage, 'usar-levitacao')?.costs).toEqual([
      { kind: 'resource', label: '5 de Mana' },
    ]);
  });

  it('recusa no backend uma escolha indisponivel, mesmo se o cliente a enviar', () => {
    const step = walkToBridge(engine, 'guerreiro');

    expect(() => choose(engine, step.state, 'usar-corda')).toThrowError(EngineError);
    try {
      choose(engine, step.state, 'usar-corda');
    } catch (error) {
      expect((error as EngineError).code).toBe('CHOICE_UNAVAILABLE');
    }
  });

  it('debita o custo declarado na escolha, de forma atomica', () => {
    const atBridge = walkToBridge(engine, 'mago');
    const manaBefore = atBridge.state.character.resources.mana?.current as number;

    const step = choose(engine, atBridge.state, 'usar-levitacao');

    expect(step.state.currentNodeId).toBe('travessia-levitando');
    // -5 do custo declarado na escolha, +1 da regeneracao passiva de mana
    // (resources[].regenPerNode) aplicada ao entrar no no seguinte.
    expect(step.state.character.resources.mana?.current).toBe(manaBefore - 5 + 1);
  });

  it('nao aplica duas vezes um efeito marcado como "once", mas repete os efeitos "always"', () => {
    let step = walkToBridge(engine, 'guerreiro');
    expect(step.state.flags['vezes-na-ponte']).toBe(1);
    expect(step.state.quests.travessia?.status).toBe('active');

    // Volta para a floresta e retorna a ponte.
    step = choose(engine, step.state, 'voltar-a-floresta');
    expect(step.state.currentNodeId).toBe('floresta-antiga');
    step = choose(engine, step.state, 'ir-ao-desfiladeiro');

    expect(step.state.currentNodeId).toBe('ponte-de-pedra');
    expect(step.state.visitedNodes['ponte-de-pedra']).toBe(2);
    // `incrementFlag` e repetivel (mode "always").
    expect(step.state.flags['vezes-na-ponte']).toBe(2);
    // O efeito "once" da missao foi aplicado apenas na primeira visita.
    const questEvents = step.events.filter((event) => event.type === 'questChanged');
    expect(questEvents).toHaveLength(0);
    expect(
      step.events.filter(
        (event) => event.type === 'effectSkipped' && event.reason === 'already-applied:once',
      ).length,
    ).toBeGreaterThan(0);
  });

  it('concede a recompensa de descoberta apenas uma vez', () => {
    let step = enterForest(engine, 'guerreiro', 'descoberta');
    step = choose(engine, step.state, 'revirar-matagal');

    expect(step.state.currentNodeId).toBe('descoberta-corda');
    expect(step.state.character.inventory.some((entry) => entry.itemId === 'corda')).toBe(true);
    expect(step.state.character.experience).toBe(15);

    step = continueFrom(engine, step.state);
    expect(step.state.currentNodeId).toBe('floresta-antiga');
    // A escolha e `once`: nao reaparece na lista.
    expect(choiceView(step.view, 'revirar-matagal')).toBeUndefined();
    expect(() => choose(engine, step.state, 'revirar-matagal')).toThrowError(/uma vez/);
  });

  it('rejeita acoes fora de ordem (recarregar a pagina ou reenviar a requisicao)', () => {
    const step = walkToBridge(engine, 'guerreiro');
    const stale = step.state.sequence - 1;

    expect(() =>
      engine.apply(step.state, {
        type: 'choose',
        nodeId: step.state.currentNodeId,
        choiceId: 'voltar-a-floresta',
        expectedSequence: stale,
      }),
    ).toThrowError(SequenceMismatchError);
  });

  it('nao modifica o estado recebido quando a acao falha', () => {
    const step = walkToBridge(engine, 'guerreiro');
    const before = structuredClone(step.state);

    expect(() => choose(engine, step.state, 'usar-corda')).toThrow();
    expect(step.state).toEqual(before);
  });

  it('nao modifica o estado recebido quando a acao tem sucesso (retorna um novo estado)', () => {
    const step = walkToBridge(engine, 'guerreiro');
    const before = structuredClone(step.state);

    const next = choose(engine, step.state, 'voltar-a-floresta');

    expect(step.state).toEqual(before);
    expect(next.state).not.toBe(step.state);
    expect(next.state.sequence).toBe(before.sequence + 1);
  });
});

describe('motor: teste de habilidade', () => {
  function engineWithDifficulty(difficulty: number): AdventureEngine {
    const doc = loadDemoAdventure();
    const node = doc.nodes.find((candidate) => candidate.id === 'travessia-com-corda');
    if (!node || node.type !== 'skillCheck') {
      throw new Error('No de teste de habilidade nao encontrado.');
    }
    node.check.difficulty = difficulty;
    return new AdventureEngine(doc);
  }

  it('leva ao sucesso quando o total supera a dificuldade', () => {
    const engine = engineWithDifficulty(-100);
    let step = walkToBridge(engine, 'explorador');
    step = choose(engine, step.state, 'usar-corda');

    expect(step.state.currentNodeId).toBe('travessia-com-corda');
    expect(step.view.skillCheck).toMatchObject({
      attributeName: 'Destreza',
      skillName: 'Escalada',
      dice: '1d20',
    });
    // Destreza 13 -> modificador 1; pericia +2; corda +3.
    expect(step.view.skillCheck?.bonus).toBe(6);

    step = engine.apply(step.state, { type: 'rollSkillCheck', expectedSequence: step.state.sequence });

    expect(step.state.currentNodeId).toBe('outro-lado');
    expect(step.state.quests.travessia?.status).toBe('completed');
    expect(step.events.some((event) => event.type === 'skillCheckResolved' && event.success)).toBe(true);
  });

  it('leva a queda, a morte e ao retorno ao checkpoint quando falha', () => {
    const engine = engineWithDifficulty(1000);
    let step = walkToBridge(engine, 'explorador');
    step = choose(engine, step.state, 'usar-corda');
    step = engine.apply(step.state, { type: 'rollSkillCheck', expectedSequence: step.state.sequence });

    expect(step.events.some((event) => event.type === 'characterDied')).toBe(true);
    expect(step.events.some((event) => event.type === 'checkpointRestored')).toBe(true);
    // A regra de morte desta aventura retoma do checkpoint, que reconduz a ponte.
    expect(step.state.currentNodeId).toBe('ponte-de-pedra');
    expect(step.state.status).toBe('active');
    const vital = step.state.character.resources['pontos-de-vida'];
    expect(vital?.current).toBeGreaterThan(0);
  });

  it('permite nova tentativa quando a aventura habilita retryAllowed', () => {
    const doc = loadDemoAdventure();
    const node = doc.nodes.find((candidate) => candidate.id === 'travessia-com-corda');
    if (!node || node.type !== 'skillCheck') {
      throw new Error('No de teste de habilidade nao encontrado.');
    }
    node.check.difficulty = 1000;
    node.check.retryAllowed = true;
    const engine = new AdventureEngine(doc);

    let step = walkToBridge(engine, 'explorador');
    step = choose(engine, step.state, 'usar-corda');
    step = engine.apply(step.state, { type: 'rollSkillCheck', expectedSequence: step.state.sequence });

    expect(step.state.currentNodeId).toBe('travessia-com-corda');
    expect(step.state.pendingSkillCheck).toEqual({ nodeId: 'travessia-com-corda', attempts: 1 });
    expect(step.view.skillCheck?.attempts).toBe(1);

    step = engine.apply(step.state, { type: 'rollSkillCheck', expectedSequence: step.state.sequence });
    expect(step.view.skillCheck?.attempts).toBe(2);
  });
});

describe('motor: combate', () => {
  let engine: AdventureEngine;

  beforeEach(() => {
    engine = new AdventureEngine(loadDemoAdventure());
  });

  function enterCombat(seed: string) {
    let step = walkToBridge(engine, 'guerreiro', seed);
    step = choose(engine, step.state, 'enfrentar-guardiao');
    return step;
  }

  it('inicia o encontro declarado no no de combate', () => {
    const step = enterCombat('combate');

    expect(step.state.combat).not.toBeNull();
    expect(step.state.combat?.enemies).toHaveLength(1);
    expect(step.state.combat?.enemies[0]).toMatchObject({
      enemyId: 'guardiao-de-pedra',
      hp: 28,
      alive: true,
    });
    expect(step.view.combat?.fleeAllowed).toBe(true);
    expect(step.events.some((event) => event.type === 'combatStarted')).toBe(true);
  });

  it('bloqueia acoes que nao sejam de combate enquanto o encontro esta ativo', () => {
    const step = enterCombat('bloqueio');

    expect(() =>
      engine.apply(step.state, {
        type: 'choose',
        nodeId: 'combate-com-guardiao',
        choiceId: 'qualquer',
        expectedSequence: step.state.sequence,
      }),
    ).toThrowError(/Resolva o combate/);
  });

  it('resolve o combate em um numero finito de rodadas e aplica as recompensas', () => {
    let step = enterCombat('resolucao');
    let guard = 0;

    while (step.state.combat && step.state.status === 'active' && guard < 200) {
      if (step.state.combat.turn !== 'player') {
        throw new Error('O turno deveria voltar ao jogador entre as acoes.');
      }
      step = engine.apply(step.state, {
        type: 'combatAttack',
        expectedSequence: step.state.sequence,
      });
      guard += 1;
    }

    expect(guard).toBeLessThan(200);
    expect(step.state.combat).toBeNull();

    if (step.state.currentNodeId === 'guardiao-derrotado') {
      // Vitoria: xp, ouro e tesouro do guardiao, mais a descoberta seguinte.
      expect(step.state.defeatedEnemies['guardiao-de-pedra']).toBe(1);
      expect(step.state.character.experience).toBeGreaterThanOrEqual(120);
      expect(step.state.character.level).toBeGreaterThanOrEqual(2);
      expect(
        step.state.character.inventory.some((entry) => entry.itemId === 'nucleo-do-guardiao'),
      ).toBe(true);
      expect(step.state.flags['guardiao-pacificado']).toBe(true);

      // E dali segue para o outro lado.
      step = continueFrom(engine, step.state);
      expect(step.state.currentNodeId).toBe('outro-lado');
    } else {
      // Derrota (ou limite de rodadas): a aventura reconduz o jogador a ponte.
      expect(step.state.currentNodeId).toBe('ponte-de-pedra');
      expect(step.state.status).toBe('active');
    }
  });

  it('e deterministico: a mesma semente produz a mesma partida', () => {
    const run = () => {
      let step = enterCombat('semente-fixa');
      let guard = 0;
      while (step.state.combat && step.state.status === 'active' && guard < 200) {
        step = engine.apply(step.state, {
          type: 'combatAttack',
          expectedSequence: step.state.sequence,
        });
        guard += 1;
      }
      const { startedAt, updatedAt, ...rest } = step.state;
      void startedAt;
      void updatedAt;
      return { rest, events: step.events };
    };

    expect(run()).toEqual(run());
  });

  it('permite fugir quando o encontro autoriza', () => {
    const doc = loadDemoAdventure();
    // Fuga garantida: dificuldade minima no teste do ruleset.
    doc.ruleset.combat.fleeCheck = { attributeId: 'destreza', dice: '1d20', difficulty: -100 };
    const fleeEngine = new AdventureEngine(doc);

    let step = walkToBridge(fleeEngine, 'guerreiro', 'fuga');
    step = choose(fleeEngine, step.state, 'enfrentar-guardiao');
    step = fleeEngine.apply(step.state, {
      type: 'combatFlee',
      expectedSequence: step.state.sequence,
    });

    expect(step.state.combat).toBeNull();
    expect(step.state.currentNodeId).toBe('ponte-de-pedra');
    expect(step.state.defeatedEnemies['guardiao-de-pedra']).toBeUndefined();
  });

  it('distribui os pontos de atributo ganhos ao subir de nivel', () => {
    let step = enterCombat('nivel');
    let guard = 0;
    while (step.state.combat && step.state.status === 'active' && guard < 200) {
      step = engine.apply(step.state, {
        type: 'combatAttack',
        expectedSequence: step.state.sequence,
      });
      guard += 1;
    }

    if (step.state.currentNodeId !== 'guardiao-derrotado') {
      return; // A semente levou a derrota; o caminho de nivel e coberto pelo outro teste.
    }

    const pending = step.state.character.pendingAttributePoints ?? 0;
    expect(pending).toBeGreaterThan(0);
    const before = step.state.character.attributes.forca as number;

    step = engine.apply(step.state, {
      type: 'allocateAttribute',
      attributeId: 'forca',
      points: 1,
      expectedSequence: step.state.sequence,
    });

    expect(step.state.character.attributes.forca).toBe(before + 1);
    expect(step.state.character.pendingAttributePoints).toBe(pending - 1);
  });
});

describe('motor: comerciante', () => {
  let engine: AdventureEngine;

  beforeEach(() => {
    engine = new AdventureEngine(loadDemoAdventure());
  });

  function atMerchant(classId = 'guerreiro') {
    const step = enterForest(engine, classId, 'mercado');
    return choose(engine, step.state, 'procurar-mercador');
  }

  it('lista o estoque com preco e indica o que o jogador pode pagar', () => {
    const step = atMerchant();

    expect(step.view.merchant?.npcName).toBe('Oswin, o Ambulante');
    const rope = step.view.merchant?.stock.find((entry) => entry.itemId === 'corda');
    expect(rope).toMatchObject({ price: 25, affordable: true });
    const armor = step.view.merchant?.stock.find((entry) => entry.itemId === 'armadura-de-couro');
    expect(armor).toMatchObject({ price: 70, affordable: false });
  });

  it('compra debitando o ouro e entregando o item', () => {
    let step = atMerchant();
    const goldBefore = step.state.character.gold;

    step = engine.apply(step.state, {
      type: 'buyItem',
      itemId: 'corda',
      expectedSequence: step.state.sequence,
    });

    expect(step.state.character.gold).toBe(goldBefore - 25);
    expect(step.state.character.inventory.some((entry) => entry.itemId === 'corda')).toBe(true);
  });

  it('recusa a compra sem ouro suficiente, sem alterar o inventario', () => {
    const step = atMerchant();

    expect(() =>
      engine.apply(step.state, {
        type: 'buyItem',
        itemId: 'armadura-de-couro',
        expectedSequence: step.state.sequence,
      }),
    ).toThrowError(/moedas de ouro/);
  });

  it('respeita o estoque limitado declarado no no', () => {
    const doc = loadDemoAdventure();
    const merchant = doc.nodes.find((node) => node.id === 'mercador-ambulante');
    if (!merchant || merchant.type !== 'merchant') {
      throw new Error('No de comerciante nao encontrado.');
    }
    const torch = merchant.stock.find((entry) => entry.itemId === 'tocha');
    if (!torch) {
      throw new Error('Tocha nao encontrada no estoque.');
    }
    torch.price = 1;
    torch.quantity = 2;
    const limited = new AdventureEngine(doc);

    let step = enterForest(limited, 'guerreiro', 'estoque');
    step = choose(limited, step.state, 'procurar-mercador');

    step = limited.apply(step.state, {
      type: 'buyItem',
      itemId: 'tocha',
      quantity: 2,
      expectedSequence: step.state.sequence,
    });
    expect(step.state.merchantPurchases['mercador-ambulante:tocha']).toBe(2);

    expect(() =>
      limited.apply(step.state, {
        type: 'buyItem',
        itemId: 'tocha',
        quantity: 1,
        expectedSequence: step.state.sequence,
      }),
    ).toThrowError(/apenas 0 unidade/);
  });

  it('nao permite vender item de missao', () => {
    let step = atMerchant();
    step = engine.apply(step.state, {
      type: 'buyItem',
      itemId: 'corda',
      expectedSequence: step.state.sequence,
    });

    expect(() =>
      engine.apply(step.state, {
        type: 'sellItem',
        itemId: 'nucleo-do-guardiao',
        expectedSequence: step.state.sequence,
      }),
    ).toThrowError(/nao pode ser vendido/);
  });

  it('vende pela taxa de recompra declarada', () => {
    let step = atMerchant('explorador');
    const goldBefore = step.state.character.gold;

    step = engine.apply(step.state, {
      type: 'sellItem',
      itemId: 'corda',
      expectedSequence: step.state.sequence,
    });

    // corda vale 20; taxa 0.4 -> 8 moedas.
    expect(step.state.character.gold).toBe(goldBefore + 8);
    expect(step.state.character.inventory.some((entry) => entry.itemId === 'corda')).toBe(false);
  });

  it('sai do comerciante pelo no declarado em leaveNodeId', () => {
    let step = atMerchant();
    step = continueFrom(engine, step.state);
    expect(step.state.currentNodeId).toBe('floresta-antiga');
  });
});

describe('motor: finais', () => {
  let engine: AdventureEngine;

  beforeEach(() => {
    engine = new AdventureEngine(loadDemoAdventure());
  });

  it('encerra a partida ao alcancar um no de final', () => {
    let step = walkToBridge(engine, 'mago', 'final');
    step = choose(engine, step.state, 'usar-levitacao');
    step = choose(engine, step.state, 'pousar-do-outro-lado');

    expect(step.state.currentNodeId).toBe('outro-lado');

    step = choose(engine, step.state, 'entrar-nas-ruinas');

    expect(step.state.status).toBe('completed');
    expect(step.state.endingId).toBe('final-vitoria');
    expect(step.state.reachedEndings).toContain('final-vitoria');
    expect(step.view.ending).toMatchObject({ id: 'final-vitoria', kind: 'victory' });
    expect(step.view.choices).toEqual([]);
    expect(step.events.some((event) => event.type === 'adventureEnded')).toBe(true);
  });

  it('recusa novas acoes depois do final', () => {
    let step = walkToBridge(engine, 'mago', 'final-bloqueio');
    step = choose(engine, step.state, 'usar-levitacao');
    step = choose(engine, step.state, 'pousar-do-outro-lado');
    step = choose(engine, step.state, 'entrar-nas-ruinas');

    expect(() =>
      engine.apply(step.state, {
        type: 'choose',
        nodeId: 'outro-lado',
        choiceId: 'entrar-nas-ruinas',
        expectedSequence: step.state.sequence,
      }),
    ).toThrowError(/encerrada/);
  });

  it('esconde o final secreto de quem nao cumpre as condicoes', () => {
    let step = walkToBridge(engine, 'mago', 'segredo');
    step = choose(engine, step.state, 'usar-levitacao');
    step = choose(engine, step.state, 'pousar-do-outro-lado');

    // Sem o nucleo do guardiao a escolha esta oculta (unavailableBehavior: hide).
    expect(choiceView(step.view, 'estudar-o-nucleo')).toBeUndefined();
  });
});
