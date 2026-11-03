# O formato das aventuras

Uma aventura é um **grafo direcionado de nós narrativos** declarado em JSON.
Cada nó é um acontecimento; as arestas são escolhas, resultados de testes e
desfechos de combate. Toda a lógica da história vive no documento — o motor
apenas o interpreta.

- Contrato: [`packages/engine/src/schema/adventure.schema.json`](../packages/engine/src/schema/adventure.schema.json) (JSON Schema 2020-12)
- Pelo ar: `GET /api/adventures/schema`
- Exemplo completo: [`examples/adventures/a-ponte-quebrada.json`](../examples/adventures/a-ponte-quebrada.json)
- Validar sem gravar: `POST /api/adventures/validate`

```bash
node packages/engine/dist/cli/validate-adventure.js minha-aventura.json
```

## Estrutura geral

```jsonc
{
  "schemaVersion": "1.0.0",      // versão do contrato
  "metadata": { … },             // identidade, autoria, gênero, capa
  "ruleset": { … },              // o sistema de RPG desta história
  "characterCreation": { … },    // o que o jogador pode escolher
  "attributes": [ … ],           // força, destreza…
  "resources": [ … ],            // pontos de vida, mana…
  "classes": [ … ],
  "races": [ … ],
  "skills": [ … ],
  "items": [ … ],
  "enemies": [ … ],
  "npcs": [ … ],
  "quests": [ … ],
  "variables": [ … ],            // flags narrativas
  "nodes": [ … ],                // o grafo
  "endings": [ … ],
  "assets": [ … ]                // imagens, áudio, vídeo, modelos
}
```

Obrigatórios: `schemaVersion`, `metadata`, `ruleset`, `characterCreation`,
`attributes`, `resources`, `classes`, `races`, `nodes`, `endings`.

Identificadores seguem `^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$` (sem acentos e sem
espaços) e precisam ser únicos dentro da sua coleção. Nomes e textos visíveis
são strings livres, com acentuação normal.

## `ruleset` — o sistema de regras é da aventura

O LoneTale não impõe um sistema. Cada história declara o seu.

```jsonc
"ruleset": {
  "skillCheck": {
    "mode": "diceVsDifficulty",              // ou "attributeVsDifficulty" (sem dados)
    "defaultDice": "1d20",
    "attributeModifier": { "divisor": 3, "offset": 10 },  // mod = floor((v-10)/3)
    "criticalSuccessOn": 20,
    "criticalFailureOn": 1,
    "skillBonus": 2
  },
  "combat": {
    "enabled": true,
    "initiative": "roll",                    // playerFirst | enemyFirst | roll
    "fleeAllowed": true,
    "fleeCheck": { "attributeId": "destreza", "dice": "1d20", "difficulty": 12 },
    "armorMode": "subtract",                 // ou "ignore"
    "minimumDamage": 1,
    "attackRules": {
      "mode": "rollToHit",                   // ou "alwaysHit"
      "hitDice": "1d20",
      "attackAttributeId": "forca",
      "damageAttributeId": "forca",
      "playerDefenseBase": 10,
      "defenseAttributeId": "destreza",
      "unarmedDamageDice": "1d3"
    },
    "maxRounds": 30
  },
  "progression": {
    "enabled": true,
    "xpThresholds": [100, 250, 500, 900],
    "onLevelUp": { "attributePoints": 1, "resourceGains": [ … ] }
  },
  "death": {
    "onVitalDepleted": "restartCheckpoint",  // ou "ending" | "goto"
    "vitalResourceId": "pontos-de-vida",
    "endingId": "final-derrota"
  }
}
```

Uma história puramente narrativa desliga `combat.enabled` e
`progression.enabled` e usa `skillCheck.mode: "attributeVsDifficulty"` — ou
simplesmente não cria nós de teste.

Dados suportados: qualquer `NdM(+K)` até 100 dados e 1000 faces — `1d6`, `1d10`,
`1d20`, `2d6`, `2d4+1`. Declare em `allowedDice` o conjunto que a aventura usa;
o validador avisa quando algum nó sai dele.

## Tipos de nó

| Tipo | Para quê | Campos próprios |
|---|---|---|
| `story` | narrativa com escolhas | — |
| `dialogue` | conversa com NPC | `npcId`, `lines[]` (cada linha com `when` opcional) |
| `combat` | encontro | `encounter` |
| `merchant` | compra e venda | `stock[]`, `buybackRate`, `leaveNodeId` |
| `discovery` | achado, com recompensa | `rewards[]`, `continueNodeId` |
| `event` | acontecimento sorteado | `outcomes[]` (ponderados), `continueNodeId` |
| `skillCheck` | teste de habilidade | `check` |
| `checkpoint` | ponto de retomada | `label`, `continueNodeId` |
| `ending` | desfecho | `endingId` |

Campos comuns a todos: `id`, `type`, `title`, `text`, `image`, `media[]`,
`audio`, `entryConditions` + `fallbackNodeId`, `onEnter[]`, `onExit[]`,
`choices[]`, `checkpoint`, `visual` (posição no editor), `tags`, `metadata`.

Nós de `checkpoint` avançam sozinhos para `continueNodeId`: o jogador não vê uma
tela só para salvar. Nós de `event` com `outcomes` resolvem o sorteio na entrada.

## Escolhas

```jsonc
{
  "id": "usar-levitacao",
  "label": "Conjurar levitação e flutuar sobre o abismo",
  "order": 2,
  "conditions": {
    "type": "all",
    "conditions": [
      { "type": "hasSkill", "skillId": "levitacao" },
      { "type": "resourceAtLeast", "resourceId": "mana", "value": 5 }
    ]
  },
  "unavailableBehavior": "disable",
  "cost": [{ "type": "spendResource", "resourceId": "mana", "amount": 5 }],
  "target": { "kind": "node", "nodeId": "travessia-levitando" }
}
```

`cost[]` é debitado **antes** dos `effects[]`. Se faltar recurso, o passo inteiro
falha sem aplicar nada — a transação é atômica.

### Três comportamentos de apresentação

O JSON controla como uma escolha indisponível aparece:

| Quer que o jogador… | Como declarar |
|---|---|
| veja e possa escolher | sem `conditions`, ou condições satisfeitas |
| veja bloqueada, com o motivo | `conditions` + `unavailableBehavior: "disable"` (padrão) |
| não veja nada | `conditions` + `unavailableBehavior: "hide"` |

`unavailableLabel` substitui o motivo gerado automaticamente:

```jsonc
"unavailableLabel": "Você precisaria de uma corda."
```

### Destinos

```jsonc
{ "kind": "node",    "nodeId": "outro-lado" }
{ "kind": "ending",  "endingId": "final-vitoria" }
{ "kind": "back" }                               // volta ao nó anterior
{ "kind": "stay" }                               // permanece
{ "kind": "random",  "options": [{ "nodeId": "a", "weight": 2 }, { "nodeId": "b", "weight": 1 }] }
{ "kind": "conditional",
  "branches": [{ "when": { "type": "hasItem", "itemId": "tocha" }, "nodeId": "caverna-iluminada" }],
  "otherwiseNodeId": "caverna-escura" }
```

## Condições

Declarativas, compostas com `all`, `any` e `not`. **Nenhuma expressão é
executada como código.**

| Tipo | Significado |
|---|---|
| `hasItem` | possui item (com `quantity`) |
| `hasEquippedItem` | tem item equipado (por `itemId` ou `slot`) |
| `hasSkill` | possui habilidade |
| `attributeAtLeast` / `attributeCompare` | valor de atributo |
| `hasClass` / `hasRace` | pertence a classe/espécie |
| `goldAtLeast` | ouro suficiente |
| `resourceAtLeast` | recurso suficiente (absoluto ou `asRatio`) |
| `flagEquals` / `flagCompare` | variável narrativa |
| `questStatus` / `questStageAtLeast` | estado da missão |
| `enemyDefeated` | derrotou criatura (com `count`) |
| `nodeVisited` | visitou local (com `times`) |
| `choiceTaken` | tomou decisão anterior |
| `npcRelationAtLeast` | relacionamento com NPC |
| `levelAtLeast` | nível mínimo |
| `endingReached` | já alcançou um final |
| `always` / `never` | constantes |

## Efeitos

```jsonc
{ "id": "recompensa.corda", "mode": "once", "type": "addItem", "itemId": "corda", "quantity": 1 }
```

`mode` controla a repetição:

- **`once`** — uma vez na partida. **`id` obrigatório e único no documento**: é
  a chave de idempotência persistida. Use para tesouros, experiência e marcos.
- **`perVisit`** — uma vez por visita ao nó.
- **`always`** (padrão) — toda vez que o efeito é alcançado.

`when` adiciona uma guarda condicional a qualquer efeito.

Tipos disponíveis: `addItem`, `removeItem`, `consumeItem`, `equipItem`,
`unequipItem`, `grantGold`, `spendGold`, `heal`, `damage`, `restoreResource`,
`spendResource`, `modifyResourceMax`, `modifyAttribute`, `grantExperience`,
`unlockSkill`, `startCombat`, `setQuestStatus`, `advanceQuestStage`,
`modifyNpcRelation`, `setFlag`, `incrementFlag`, `endAdventure`, `goto`,
`setCheckpoint`, `rollTable`.

Todos são aplicados e validados no backend, em transação.

## Criação de personagem

Cada aventura decide o quanto o jogador personaliza. Uma história pode exigir um
mago humano; outra, liberar tudo.

```jsonc
"characterCreation": {
  "startNodeId": "clareira-inicial",
  "allowedClassIds": ["mago"],            // uma só opção = escolha forçada
  "allowedRaceIds": ["humano"],
  "attributes": {
    "method": "pointBuy",                 // pointBuy | fixed | roll
    "points": 12,
    "minPerAttribute": 8,
    "maxPerAttribute": 16
  },
  "startingGold": 40,
  "startingItems": [{ "itemId": "tocha", "quantity": 1 }],
  "appearanceFields": [
    { "id": "cor-da-pele", "label": "Cor da pele", "kind": "select", "required": true,
      "options": [{ "id": "clara", "label": "Clara", "color": "#f0d2b8" }] },
    { "id": "altura", "label": "Altura", "kind": "number", "min": 140, "max": 210, "unit": "cm" }
  ],
  "allowDescription": true
}
```

Classes e espécies se restringem mutuamente via `allowedRaceIds` /
`allowedClassIds`, e uma espécie pode limitar opções de aparência:

```jsonc
"appearanceRestrictions": { "porte": ["esguio", "atletico"] }
```

A aparência é **persistida** em `Characters.appearance`, mesmo que nenhum avatar
a desenhe hoje: é o que permitirá retratos e modelos 3D depois.

## Validação

Duas camadas, ambas obrigatórias antes de publicar.

**1. Estrutural** — JSON Schema 2020-12. `additionalProperties: false` em
condições, efeitos e nós, para que um campo digitado errado seja erro e não
silêncio.

**2. Semântica** — `validateAdventure()`:

- ids duplicados em qualquer coleção;
- integridade referencial: todo `itemId`, `skillId`, `nodeId`, `enemyId`,
  `questId`, `npcId`, `endingId` e `assetId` citado precisa existir;
- expressões de dados válidas e dentro de `allowedDice`;
- efeitos `once` com `id` presente e único;
- nós com `entryConditions` precisam de `fallbackNodeId`;
- slots de equipamento existentes em `ruleset.inventory.equipmentSlots`;
- **alcançabilidade**: nós inatingíveis a partir de `startNodeId` (aviso);
- finais nunca referenciados (aviso);
- becos sem saída, consumíveis sem efeito, criaturas inofensivas (avisos).

Erros impedem a publicação. Avisos aparecem no Studio. A aventura de exemplo é
mantida **sem nenhum erro e sem nenhum aviso** — um teste garante isso, para que
ela sirva de referência de autoria limpa.

## Versionamento

`metadata.version` é a versão de conteúdo (semver). Publicar congela a versão:

- uma partida iniciada na 1.0 continua lendo a 1.0 depois de a 1.1 entrar no ar;
- para editar, abra uma nova versão (`POST /api/adventures/:id/versions`);
- cada versão guarda um checksum SHA-256 do documento canonicalizado.

`schemaVersion` é a versão do **contrato**. O motor recusa um documento cuja
versão maior não seja a sua.
