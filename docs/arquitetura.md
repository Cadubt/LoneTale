# Arquitetura

## Os quatro componentes

### Adventure Engine — `packages/engine`

O núcleo. TypeScript puro, sem nenhuma dependência de framework: as únicas
dependências são `ajv` e `ajv-formats`, usadas pela validação do contrato.

Interface essencial:

```ts
const engine = new AdventureEngine(documento);

const inicio = engine.startGame(rascunhoDePersonagem, { seed });
const passo  = engine.apply(estado, { type: 'choose', nodeId, choiceId, expectedSequence });
const visao  = engine.view(estado);
```

`apply` é uma função: recebe o estado, devolve `{ state, events, view }`.
Trabalha sempre sobre um **clone profundo** do estado recebido, por isso:

- se qualquer regra falhar no meio, o estado original fica intacto — não existe
  aplicação parcial;
- combinado com uma transação no banco, o passo inteiro é atômico;
- testar não exige banco, HTTP nem mocks.

Responsabilidades: interpretar o documento, avaliar condições, aplicar efeitos,
resolver testes de habilidade e combate, controlar morte e checkpoints, decidir
navegação e projetar o estado para o cliente.

**Não** é responsabilidade do motor: persistir, autenticar, autorizar, falar
HTTP. Isso fica na API.

### Persistence Layer — `apps/api/src/database`, entidades por módulo

TypeORM sobre SQL Server, exclusivamente no schema `lonetale`.
Ver [`banco-de-dados.md`](banco-de-dados.md).

### Adventure Studio — `apps/api/src/adventures` + `apps/web/src/pages/studio`

Criação, validação, versionamento e publicação de aventuras. Uma versão
publicada é imutável.

### LoneTale Player — `apps/web`

Renderiza a projeção (`NodeView`) que o servidor devolve. Não reavalia nenhuma
regra da aventura.

---

## Por que o frontend não tem a lógica autoritativa

Se o cliente decidisse se uma escolha está disponível, qualquer pessoa com o
DevTools aberto atravessaria a ponte sem corda. Então o servidor avalia as
condições e manda o resultado:

```ts
interface ChoiceView {
  id: string;
  label: string;
  available: boolean;
  blockedReason?: string;   // "Requer Corda de cânhamo."
  costs?: Array<{ kind: string; label: string }>;
}
```

O cliente desenha isso. E, mesmo que alguém envie uma escolha bloqueada direto
na API, `AdventureEngine.handleChoose` reavalia as condições e recusa com
`CHOICE_UNAVAILABLE` — a interface e a API checam a mesma coisa, mas só a API
decide.

Efeito colateral útil: `blockedReason` é texto para o jogador, escrito pelo
autor (`unavailableLabel`) ou gerado pelo avaliador. A interface não precisa
saber traduzir condições.

---

## Fluxo de uma ação

```
Cliente  POST /api/sessions/:id/actions
         { type: "choose", nodeId, choiceId, expectedSequence: 7, idempotencyKey }
                                │
GameService.applyAction         ▼
  1. a chave de idempotência já foi usada?  → devolve o estado atual, sem reaplicar
  2. abre transação
  3. SELECT ... WITH (UPDLOCK)        ← serializa ações simultâneas da mesma partida
  4. engine.apply(estado, ação)       ← regras, sobre um clone
  5. UPDATE GameSessions ... WHERE sequence = 7
         └─ 0 linhas afetadas? outra requisição passou na frente → rollback
  6. INSERT GameEvents (marcador da ação + eventos do motor)
  7. reescreve a projeção CharacterInventory
  8. atualiza Characters (nível, experiência)
  9. commit
                                │
Cliente  ◀───────────────────────  { view, events }
```

Cada passo do pipeline tem uma razão:

- **(1) idempotência** cobre o caso em que a resposta se perde na rede e o
  cliente repete. Sem isso, o jogador poderia receber o mesmo tesouro duas vezes.
- **(3) trava pessimista** cobre duas abas abertas na mesma partida.
- **(5) `WHERE sequence = N`** cobre a corrida entre ler e gravar, que a trava
  por si só não fecharia se a leitura tivesse acontecido antes dela.

As três camadas se sobrepõem de propósito: é mais barato do que explicar a um
jogador por que o ouro dele desapareceu.

---

## Idempotência de efeitos, em três níveis

O autor declara o comportamento de cada efeito:

```jsonc
{ "id": "recompensa.corda", "mode": "once",     "type": "addItem", "itemId": "corda" }
{                           "mode": "perVisit", "type": "heal", "amount": 5 }
{                           "mode": "always",   "type": "incrementFlag", "flag": "vezes-na-ponte", "delta": 1 }
```

- `once` — uma vez na partida. A chave `once:<id>` entra em
  `state.consumedEffects`. O validador **exige** `id` neste modo, e exige que
  ele seja único no documento: sem isso, não há como garantir execução única.
- `perVisit` — uma vez por visita. A chave inclui a visita:
  `visit:node:ponte-de-pedra#3:<caminho>`.
- `always` (padrão) — toda vez.

O teste `não aplica duas vezes um efeito marcado como "once"` verifica isso
indo à ponte, voltando à floresta e retornando: o contador `vezes-na-ponte`
sobe para 2, mas a missão só é iniciada uma vez.

---

## Aleatoriedade reproduzível

Rolagens acontecem **só no servidor**, com um PRNG com semente (`sfc32` sobre
`cyrb128`). O estado persistido é apenas `{ seed, cursor }`: ao retomar, o
gerador é reconstruído e avançado `cursor` vezes.

Isso dá três coisas de uma vez:

- **testes determinísticos** — `{ seed: 'teste' }` e a partida é sempre a mesma;
- **auditoria** — com a semente e o log de eventos, a partida se reconstrói;
- **nada de estado interno do PRNG no banco** — dois números bastam.

```ts
const rng = SeededRng.fromState({ seed: 'lonetale', cursor: 42 });
rollDice('2d6+3', rng, bonus); // → { dice: [4, 2], natural: 6, total: 11 }
```

Expressões de dados passam por um parser estrito
(`/^\s*(\d{1,3})\s*[dD]\s*(\d{1,4})\s*(?:([+-])\s*(\d{1,4})\s*)?$/`), com
limites de 100 dados e 1000 faces. `"1d6; rm -rf /"` é recusado como expressão
inválida, não interpretado.

---

## Segurança do conteúdo

Uma aventura é **dado**, nunca código. Condições e efeitos são uniões
discriminadas avaliadas por `switch`:

```ts
case 'hasItem': {
  const owned = itemQuantity(character, condition.itemId);
  return owned >= (condition.quantity ?? 1);
}
```

Não há `eval`, `new Function`, template de expressão nem interpretador de
fórmulas. Um tipo desconhecido (documento de uma versão futura) **bloqueia** a
escolha em vez de liberá-la — falha fechada.

---

## Extensibilidade

**Novo tipo de nó**: acrescente a variante em `AdventureNode`
(`src/types/adventure.ts`), registre-a em `NODE_TYPES` (`src/registry.ts`) e
descreva-a no JSON Schema. A asserção de exaustividade em `registry.ts` quebra o
build se você esquecer a lista, e um teste quebra se o schema divergir:

```ts
type Exhaustive<All extends string, Registered extends readonly string[]> =
  Exclude<All, Registered[number]> extends never ? true : never;

const _nodesAreExhaustive: Exhaustive<NodeType, typeof NODE_TYPES> = true;
```

Depois trate o tipo em `AdventureEngine.enterNode` e em `buildView`.

**Nova condição ou efeito**: mesmo caminho, mais um `case` no avaliador ou no
aplicador. O teste `contrato: schema x tipos TypeScript` compara os `const` do
schema com os registros do motor e falha na divergência — é o que impede o
schema e os tipos de se afastarem com o tempo.

**Novo sistema de regras**: nada a programar. `ruleset` já declara dados,
modificadores de atributo, críticos, iniciativa, armadura, progressão, morte e
economia. Uma aventura puramente narrativa desliga `combat.enabled` e
`progression.enabled`.

---

## Caminho para o Meta Quest 3

O motor devolve estado projetado, não HTML: outro cliente (WebXR, Unity) pode
consumir a mesma API. Duas decisões já olham para lá:

- a **aparência do personagem** é persistida em `Characters.appearance` como
  JSON estruturado (cor de pele, cabelo, altura, porte), mesmo que hoje nenhum
  avatar a desenhe — é o que permite gerar retratos ou modelos depois;
- `assets` distingue `image`, `audio`, `video` e `model`, e `NodeAudio` já separa
  música, ambiência e efeito.

---

## Migração para um banco exclusivo

A persistência é isolada atrás dos serviços; o motor não conhece SQL. Para sair
de um banco compartilhado para um dedicado:

1. criar o banco novo e rodar as mesmas migrations;
2. copiar os dados do schema `lonetale` (a estrutura é idêntica);
3. trocar `DB_NAME` no ambiente.

Nenhuma regra de negócio muda, porque nenhuma delas depende do nome do banco.
