# Planejamento técnico — LoneTale

Entrega da **seção 28** do prompt mestre.

## Como ler este documento

Este planejamento deveria ter vindo antes da implementação. Não veio: o prompt
que recebi estava truncado no meio da seção 9, e as seções 10 a 28 — incluindo a
instrução de apresentar o plano e aguardar aprovação — só chegaram depois de a
Fase 1 à Fase 4 já estarem construídas.

Então este documento tem duas funções ao mesmo tempo:

1. **o planejamento técnico pedido**, com as 16 partes da seção 28;
2. **uma prestação de contas honesta** do que existe, do que está parcial e do
   que não existe — como manda a diretriz 26.10 ("não implementar
   funcionalidades falsas como se estivessem prontas").

A legenda usada em todo o documento:

| | Significado |
|---|---|
| **Pronto** | implementado e exercitado por teste automatizado ou verificação direta |
| **Parcial** | existe e funciona, mas não cobre tudo o que a especificação pede |
| **Não feito** | não existe nenhuma linha a respeito |
| **Não verificado** | escrito e tipado, mas nunca executado contra a dependência real |

Nada neste repositório rodou contra um SQL Server. Toda a camada de persistência
está marcada **Não verificado** até que isso aconteça, e nenhuma migration foi
executada em banco nenhum — conforme a instrução de não alterar o banco
existente sem autorização.

---

## 1. Proposta de arquitetura

Quatro componentes, com uma regra de dependência que não é negociável: **o motor
não conhece ninguém**.

```
┌──────────────────────────────────────────────────────────────────┐
│  apps/web — LoneTale Player + Adventure Studio                   │
│  Renderiza a projeção do servidor. Zero regra de aventura.        │
└───────────────────────────────┬──────────────────────────────────┘
                                │ REST + JWT
┌───────────────────────────────▼──────────────────────────────────┐
│  apps/api — NestJS                                               │
│  Autenticação · Studio · Catálogo · Execução autoritativa        │
└──────────────┬─────────────────────────────────┬─────────────────┘
               │ usa                             │ usa
┌──────────────▼───────────────────┐  ┌──────────▼─────────────────┐
│  packages/engine                 │  │  Persistence Layer         │
│  TypeScript puro. Sem HTTP,      │  │  TypeORM → SQL Server      │
│  sem SQL, sem framework.         │  │  schema `lonetale`         │
│  Estado + ação → estado.         │  │  snapshot JSON + relacional│
└──────────────────────────────────┘  └────────────────────────────┘
```

As setas só apontam para dentro. O motor não importa NestJS nem TypeORM; a API
importa o motor. Isso é o que permite testar as regras sem banco e sem HTTP, e é
o que torna possível, mais tarde, um cliente WebXR ou uma ferramenta de linha de
comando consumindo o mesmo núcleo.

**Status: Pronto.**

### A decisão central

O enunciado diz que o frontend não deve conter a lógica autoritativa. Levei isso
ao limite: **o cliente não avalia nenhuma condição**. O servidor devolve a
escolha já julgada.

```ts
interface ChoiceView {
  id: string;
  label: string;
  available: boolean;
  blockedReason?: string;   // "Você precisaria de uma corda."
  costs?: Array<{ kind: string; label: string }>;
}
```

O ganho não é só segurança. É que a interface fica burra de propósito: ela não
precisa saber traduzir `{ type: 'all', conditions: [...] }` em português. Quem
escreve a mensagem é o autor da aventura (`unavailableLabel`) ou o avaliador, que
tem o contexto para dizer "Requer 3x Corda de cânhamo (você tem 1)".

---

## 2. Estrutura do monorepo

A seção 24 sugere uma estrutura e permite refiná-la "caso exista justificativa
técnica". Abaixo, o que existe hoje, o que difere e por quê.

```text
lonetale/
├── apps/
│   ├── web/                    Player + Studio (React, Vite)
│   └── api/                    NestJS
│       └── src/database/
│           └── migrations/     migrations do schema lonetale
├── packages/
│   └── engine/                 Adventure Engine + contrato + JSON Schema
│       ├── src/schema/         adventure.schema.json (fonte única)
│       ├── src/types/          contrato TypeScript
│       └── src/__tests__/      57 testes
├── adventures/
│   └── ponte-das-sombras/      aventura demonstrativa
├── docs/
├── .env.example
└── README.md
```

### Desvios da estrutura sugerida, e a justificativa

**`packages/adventure-engine` + `adventure-schema` + `shared-types` →
`packages/engine`.** Os três seriam um só grafo de dependência circular: os tipos
descrevem o schema, o schema valida o que os tipos declaram, e o motor precisa dos
dois. Separá-los em pacotes exigiria ou duplicar as definições ou criar um pacote
de tipos que o schema importa e que importa o schema de volta.

Mantive-os juntos e resolvi o risco real — schema e tipos divergirem — com
verificação automática: uma asserção de exaustividade em
[`registry.ts`](../packages/engine/src/registry.ts) quebra o build se um tipo novo
não entrar na lista, e o teste `contrato: schema x tipos TypeScript` compara os
`const` do schema com os registros do motor.

Se no futuro outro consumidor precisar só dos tipos (um SDK público, por
exemplo), separar vira justificável. Hoje seria complexidade sem benefício —
diretriz 26.16.

**`packages/ui` → componentes em `apps/web/src/components`.** Um pacote de UI
compartilhada se paga quando existem dois ou mais frontends. Existe um. Quando o
cliente WebXR aparecer (Fase 8), extrair é mecânico.

**`database/migrations` → `apps/api/src/database/migrations`.** O `DataSource` do
TypeORM resolve as migrations por caminho relativo a si mesmo, e a CLI precisa
compilá-las com o mesmo `tsconfig` da API. Mantê-las fora criaria um segundo
projeto TypeScript só para elas.

**Proposta de ajuste, sujeita à sua aprovação:** criar `database/` com o que é
genuinamente SQL e não TypeScript — `database/scripts/` com os `GRANT` e o
`CREATE SCHEMA` documentados em [`banco-de-dados.md`](banco-de-dados.md), e
`database/seeds/` para dados de referência em SQL puro.

**`infrastructure/` e `docker-compose.yml` → não existem.** Ainda não há o que
orquestrar: o banco é externo e pré-existente, e um `docker-compose` que suba um
SQL Server contrariaria o requisito 3.1. Faz sentido na Fase 7, com os Dockerfiles
da API e do frontend e a preparação para Azure.

**Status: Parcial** — a estrutura existe e funciona; faltam `database/scripts`,
`database/seeds` e `infrastructure/`.

---

## 3 e 4. Modelo de dados e tabelas no schema `lonetale`

Doze tabelas, todas com `schema: 'lonetale'` declarado na entidade. Detalhamento
completo, com índices e chaves estrangeiras, em
[`banco-de-dados.md`](banco-de-dados.md).

### Contas

| Tabela | Conteúdo |
|---|---|
| `Users` | identidade: e-mail único, nome, papel, locale, último acesso |
| `UserCredentials` | derivação scrypt, tentativas falhas, bloqueio temporário |
| `ExternalLogins` | vínculo OIDC, único por `(provider, subject)` |
| `RefreshTokens` | hash SHA-256, família, rotação, revogação |

`UserCredentials` é separada de `Users` para que nenhuma consulta de perfil traga
material sensível por acidente — a separação é a garantia, não a disciplina de
quem escreve a query.

### Conteúdo

| Tabela | Conteúdo |
|---|---|
| `Adventures` | identidade estável da obra: slug, autor, status, visibilidade |
| `AdventureVersions` | o conteúdo: `document NVARCHAR(MAX)`, checksum, status |
| `AdventurePublications` | trilha de auditoria: quem publicou, quando, com que notas |
| `MediaAssets` | metadados das mídias declaradas em `assets` |

Esta separação é o mecanismo que torna **versões publicadas imutáveis**
(requisito 3.4). A partida guarda `adventureVersionId`, não `adventureId`.

### Partidas

| Tabela | Conteúdo |
|---|---|
| `Characters` | ficha persistente, incluindo **aparência** em JSON |
| `GameSessions` | `stateSnapshot NVARCHAR(MAX)` + `sequence` + `rngSeed` + `version` |
| `GameEvents` | log autoritativo; carrega a chave de idempotência |
| `CharacterInventory` | projeção relacional do inventário |

**Status: Pronto** (modelagem e migration escritas) / **Não verificado**
(nenhuma execução contra banco).

### Por que snapshot JSON e não normalização completa

O requisito 3.4 pede "uma combinação adequada de tabelas relacionais e snapshots
JSON". A divisão que adotei:

**No snapshot** fica o que o motor manipula como uma unidade coerente: posição
narrativa, flags, nós visitados, inventário, equipamento, missões, combate em
andamento, estado do gerador aleatório. Quebrar isso em trinta tabelas
obrigaria a remontar o objeto a cada ação, com risco de divergência e sem ganho
de consulta.

**Em colunas e tabelas** fica o que SQL faz melhor:

- `sequence`, `status`, `updatedAt` — concorrência e índices de listagem;
- `endingId`, `playtimeSeconds` — relatórios;
- `Characters` — listar personagens sem abrir snapshot;
- `CharacterInventory` — responder "quantos jogadores carregam a corda?";
- `GameEvents` — auditoria, idempotência e telemetria narrativa.

A projeção é reescrita **dentro da mesma transação** do snapshot. As duas
representações nunca divergem porque nunca são gravadas separadamente.

Constraints `CHECK (ISJSON(coluna) = 1)` reforçam no banco o que o JSON Schema já
garante na aplicação.

**Não existem arquivos JSON por usuário.** Tudo no banco, conforme 3.4.

---

## 5. Estratégia para conectar ao banco existente

O cenário obrigatório (3.1) é um servidor e um banco que já existem, podendo
conter objetos de outras aplicações. As consequências, implementadas:

- nenhuma criação de instância ou de banco em lugar nenhum do código;
- `schema: LONETALE_SCHEMA` em todas as entidades e no `DataSource`;
- `synchronize: false` e `migrationsRun: false`, sempre;
- `migrationsTableName: 'MigrationHistory'` **dentro** do schema `lonetale`;
- conexão inteiramente por variáveis de ambiente: servidor, porta, instância
  nomeada, banco, usuário, senha, `encrypt`, `trustServerCertificate`, timeouts
  e pool ([`configuration.ts`](../apps/api/src/config/configuration.ts));
- [`SchemaBootstrapService`](../apps/api/src/database/schema-bootstrap.service.ts)
  verifica no arranque se o schema existe e se há migrations pendentes, e
  **avisa com instrução clara** em vez de improvisar;
- criar o schema é **desligado por padrão** (`DB_ALLOW_SCHEMA_CREATION=false`):
  em banco compartilhado, isso é ato do DBA.

**Status: Pronto** / **Não verificado**.

---

## 6. Configuração do TypeORM

Em [`data-source.ts`](../apps/api/src/database/data-source.ts), uma função
`buildDataSourceOptions(database, { forMigrations })` serve aos dois usos:

```ts
const credentials =
  options.forMigrations && database.admin
    ? database.admin                                        // DDL
    : { username: database.username, password: database.password };  // DML
```

É a implementação do requisito 3.3.8: a aplicação roda com o usuário de menor
privilégio, e só as migrations usam as credenciais administrativas. Datas em UTC
de ponta a ponta (`useUTC: true`).

**Status: Pronto** / **Não verificado**.

---

## 7. Estratégia de migrations seguras

A migration inicial é **escrita à mão**, não gerada. A justificativa é o banco
compartilhado:

- cada `CREATE TABLE` guardado por `IF OBJECT_ID(...) IS NULL`; cada índice por
  uma checagem em `sys.indexes` — aplicar duas vezes é seguro;
- cada objeto prefixado com `[lonetale].`, sem exceção;
- o `down` remove apenas o que o `up` criou, na ordem inversa das FKs;
- o `DROP SCHEMA` final só executa se **nada mais** restar no schema: se outra
  aplicação tiver criado algo lá, o schema permanece.

Uma migration gerada automaticamente compara o modelo com o banco inteiro e pode
propor alterações em objetos que não são nossos. Em banco compartilhado isso é
inaceitável, então a geração automática fica proibida neste projeto como regra, e
não como preferência.

**Pendente de aprovação:** executar `npm run migration:run` contra o seu SQL
Server. Não farei isso sem sua autorização expressa.

**Status: Pronto** / **Não verificado**.

---

## 8 e 9. Modelo JSON de aventuras e JSON Schema

Contrato versionado em
[`adventure.schema.json`](../packages/engine/src/schema/adventure.schema.json)
(JSON Schema draft 2020-12), espelhado por tipos TypeScript em
[`types/adventure.ts`](../packages/engine/src/types/adventure.ts). Guia de autoria
em [`aventuras-json.md`](aventuras-json.md).

O documento tem as 16 seções pedidas em 5.1, e os nove tipos de nó de 5.2:
`story`, `dialogue`, `combat`, `merchant`, `discovery`, `event`, `skillCheck`,
`checkpoint`, `ending`.

Duas escolhas que valem explicação:

**`additionalProperties: false` em condições, efeitos e nós.** Um campo digitado
errado passa a ser erro de validação, não silêncio. Para quem escreve aventuras à
mão, isso transforma uma hora de depuração em uma mensagem na tela.

**Normalização por referência.** `items`, `enemies`, `npcs`, `skills` e `assets`
são coleções com id estável, e os nós as referenciam. Nenhuma duplicação de
definição, e o validador verifica que todo id citado existe.

**Status: Pronto.**

---

## 10. Funcionamento do motor de condições e efeitos

### Condições

24 tipos, uniões discriminadas, compostas com `all` / `any` / `not`. Avaliadas
por correspondência de tipo em
[`evaluate.ts`](../packages/engine/src/conditions/evaluate.ts):

```ts
case 'hasItem': {
  const needed = condition.quantity ?? 1;
  const owned = itemQuantity(character, condition.itemId);
  if (owned >= needed) return true;
  return fail(condition, `Requer ${needed}x ${name} (você tem ${owned}).`, failed);
}
```

**Nenhum `eval`, nenhum `new Function`, nenhum interpretador de expressão** —
requisito 6 e diretriz 26.3. Um tipo desconhecido (documento de uma versão futura
do contrato) **bloqueia** a escolha em vez de liberá-la: falha fechada.

O avaliador tem duas saídas: `evaluateCondition` devolve booleano;
`explainCondition` devolve também os motivos das falhas, que alimentam o
`blockedReason` da interface.

Os três comportamentos de apresentação do requisito 6 são declarados no JSON:
escolha habilitada (condições satisfeitas), visível e bloqueada
(`unavailableBehavior: "disable"`, o padrão) e completamente oculta
(`"hide"`).

### Efeitos

25 tipos, aplicados em [`apply.ts`](../packages/engine/src/effects/apply.ts). O
requisito 7 pede para diferenciar efeito único, por visita e repetível:

| `mode` | Comportamento | Chave persistida |
|---|---|---|
| `once` | uma vez na partida | `once:<id>` — **`id` obrigatório e único no documento** |
| `perVisit` | uma vez por visita | `visit:node:<id>#<visita>:<caminho>` |
| `always` (padrão) | toda vez | nenhuma |

O validador recusa publicar um efeito `once` sem `id`, e recusa dois efeitos
`once` com o mesmo `id`: sem isso não há como garantir execução única, e um
"once" que não funciona é pior do que nenhum.

Custos (`cost[]`) são debitados **antes** dos efeitos. Faltando recurso, uma
`EngineError` aborta o passo — e como o motor trabalha sobre um clone profundo do
estado, nada é aplicado pela metade.

**Status: Pronto.**

---

## 11. Fluxo completo de uma partida

O requisito 15 descreve nove passos. Implementados literalmente em
[`GameService.applyAction`](../apps/api/src/game/game.service.ts):

```
POST /api/sessions/:id/actions
  { type: "choose", nodeId, choiceId, expectedSequence: 7, idempotencyKey }
        │
        ├─ 0. chave de idempotência já usada? → devolve o estado atual, sem reaplicar
        ├─ 1. identifica a sessão autenticada            (JwtAuthGuard + dono da partida)
        │     abre transação
        ├─ 2. carrega o estado atual                    (SELECT ... WITH (UPDLOCK))
        ├─ 3. recupera a versão correta da aventura      (adventureVersionId + cache)
        ├─ 4. valida a escolha                           (nó atual, existe, não-única-já-tomada)
        ├─ 5. avalia condições                           (recusa com CHOICE_UNAVAILABLE)
        ├─ 6. executa efeitos                            (custos, efeitos, idempotência)
        ├─ 7. atualiza a posição narrativa               (navegação, morte, finais)
        ├─ 8. persiste atomicamente
        │     UPDATE GameSessions ... WHERE sequence = 7  ← 0 linhas? rollback
        │     INSERT GameEvents · projeta inventário · atualiza Characters
        │     commit
        └─ 9. retorna o novo estado e as escolhas disponíveis
```

### Concorrência, em três camadas

O requisito 15 pede controle para que duas requisições simultâneas não avancem a
mesma partida incorretamente, e o 7 pede proteção contra execução duplicada de
recompensas. São problemas diferentes, e cada camada resolve um:

| Camada | Cobre |
|---|---|
| `idempotencyKey` + índice único filtrado | resposta perdida na rede e o cliente repete |
| `SELECT ... WITH (UPDLOCK)` | duas abas abertas na mesma partida |
| `UPDATE ... WHERE sequence = N` | corrida entre a leitura e a gravação |
| `mode: "once"` nos efeitos | revisitar o mesmo nó mais tarde |

As camadas se sobrepõem de propósito. É mais barato do que explicar a alguém por
que o ouro desapareceu.

**Status: Pronto** / **Não verificado** — a serialização e a concorrência reais
dependem do banco, e o teste correspondente da seção 23 ainda não existe.

---

## 12. Estratégia de persistência e versionamento

**Salvamento automático** após cada ação confirmada: não há botão de salvar, e o
backend é a fonte de verdade. O requisito 15 lista dezesseis itens a persistir —
todos estão no `GameState` ou nas colunas ao lado, incluindo combate em andamento
e data da última atividade.

**Versionamento imutável.** Publicar marca a versão como `published` e preenche
`publishedAt`. A partir daí:

- `saveDraft` recusa gravar sobre versão publicada;
- editar exige `POST /adventures/:id/versions`, com versão maior que a anterior;
- a partida guarda `adventureVersionId` e continua lendo aquele documento;
- cada versão guarda checksum SHA-256 do documento canonicalizado (chaves
  ordenadas), o que detecta alteração por fora.

**Status: Pronto** / **Não verificado**.

---

## 13. Organização do painel administrativo

Aqui está a maior lacuna do projeto, e vale ser direto sobre isso.

| Item (seção 16) | Status |
|---|---|
| Criar aventuras, importar JSON | Pronto |
| Editar informações, definir regras | Pronto (via documento completo) |
| Criar versões, publicar | Pronto |
| **16.3 Validador** | **Pronto** — todas as onze verificações pedidas |
| **16.1 Editor visual** | **Parcial** — grafo em React Flow, somente leitura |
| **16.2 Editor JSON** | **Parcial** — `textarea` com validação; sem destaque de sintaxe, formatação nem diff |
| **16.4 Simulador** | **Não feito** |
| Analisador de caminhos | **Não feito** |
| Exportar aventuras | **Não feito** |
| Despublicar | **Não feito** (existe arquivar) |
| CRUD granular (classes, itens, nós…) | **Não feito** — hoje só documento inteiro |

O validador (16.3) ficou completo porque é o que impede publicar conteúdo
quebrado, e porque reaproveita o motor. Já atende: nó inicial, ids duplicados,
nós/itens/NPCs/criaturas inexistentes, condições e efeitos inválidos, nós
inalcançáveis, becos sem saída e finais disponíveis. **Ciclos narrativos não são
sinalizados**, conforme o enunciado pede.

### O desenho que proponho para fechar 16.1, 16.2 e 16.4

O ponto delicado é a exigência de que "a edição visual deverá modificar a mesma
definição de aventura utilizada pelo motor, evitando dois formatos divergentes".

Minha proposta: **o documento JSON é o único modelo**. O editor visual não tem
estado próprio — ele é uma projeção e um conjunto de operações sobre o documento:

```
documento JSON (fonte única)
   │
   ├── buildAdventureGraph()  →  React Flow (ler)
   └── operações de edição    →  patch no documento  →  validar  →  salvar rascunho
```

As posições dos nós no canvas já vivem dentro do documento, em `visual.position`,
exatamente para que arrastar um bloco seja uma edição do documento e não um
estado paralelo guardado em outro lugar.

O editor JSON e o visual passam a ser duas vistas do mesmo objeto, com validação
no mesmo endpoint (`POST /adventures/validate`). O simulador (16.4) usa
`AdventureEngine` diretamente, sem persistir, com um estado descartável em
memória — o mesmo motor da partida real, como o enunciado exige.

---

## 14. Planejamento das APIs

Implementadas, documentadas em Swagger (`/api/docs`):

| Método | Rota | Função |
|---|---|---|
| POST | `/auth/register` · `/auth/login` · `/auth/refresh` · `/auth/logout` | sessão |
| GET/POST | `/auth/google/url` · `/auth/google/callback` | OIDC |
| GET | `/auth/me` | perfil |
| POST | `/auth/change-password` · `/auth/logout-all` | conta |
| GET | `/catalog` · `/catalog/:slug` | catálogo público |
| GET | `/adventures/schema` | JSON Schema |
| POST | `/adventures/validate` | validação sem gravar |
| GET/POST | `/adventures` | listar e criar |
| GET | `/adventures/:id` · `/:id/versions/:vid/document` · `/:id/assets` | Studio |
| PUT | `/adventures/:id/draft` | gravar rascunho |
| POST | `/adventures/:id/versions` · `/:id/publish` | versionar e publicar |
| GET/POST | `/sessions` | partidas |
| GET | `/sessions/:id` · `/sessions/:id/events` | estado e diário |
| POST | `/sessions/:id/actions` | **aplicar ação** |
| DELETE | `/sessions/:id` | abandonar |
| GET | `/sessions/analytics/:adventureId` | telemetria narrativa |
| GET | `/health` · `/health/ready` | saúde |

A rodar, por fase:

| Rota | Fase | Para |
|---|---|---|
| `POST /auth/forgot-password` · `/reset-password` | 1 | recuperação de senha (§14) |
| `PATCH /auth/me` | 1 | perfil (§14) |
| `POST /adventures/:id/assets` (upload) | 5 | mídias (§17) |
| `GET /adventures/:id/export` | 5 | exportar (§16) |
| `POST /adventures/:id/unpublish` | 5 | despublicar (§16) |
| `POST /adventures/:id/simulate` | 5 | simulador (§16.4) |
| `GET /adventures/:id/paths` | 5 | analisador de caminhos (§16.4) |
| `GET /adventures/:id/versions/diff` | 5 | comparação de versões (§16.2) |

**Status: Pronto** para o que está na primeira tabela.

---

## 15. Planejamento das fases

Situação real de cada fase da seção 25:

| Fase | Situação | O que falta |
|---|---|---|
| **1 — Fundação** | Quase completa | recuperação de senha; `PATCH /auth/me` |
| **2 — Adventure Engine** | **Completa** | — |
| **3 — Personagens e persistência** | Completa, **não verificada** | executar contra SQL Server |
| **4 — Mecânicas de RPG** | Parcial | resistências, vulnerabilidades e comportamento de criaturas; ação Defender; efeitos temporários; NPC com personalidade, inventário e missões; categorias de item faltantes |
| **5 — Adventure Studio** | Parcial | editor visual com edição; editor JSON decente; simulador; analisador de caminhos; exportar; despublicar; upload de mídia |
| **6 — Experiência do jogador** | Parcial | narração por voz (§18); imagens reais; classes permitidas no catálogo |
| **7 — Qualidade e implantação** | Parcial | 9 dos 14 testes obrigatórios; logs; Dockerfiles; Azure; domínio |
| **8 — Evoluções futuras** | Não iniciada | WebXR, IA, análise narrativa |

A diretriz 26.13 diz para não implementar todas as fases simultaneamente. Eu
avancei nas fases 1 a 4 de uma vez, o que foi uma consequência de não ter visto
esta instrução. Daqui para frente, uma fase por vez, com sua aprovação.

### Ordem que eu recomendo, e por quê

**Primeiro: verificar a Fase 3 contra o seu SQL Server.** É o único bloco grande
marcado "Não verificado", e tudo o que vem depois assenta sobre ele. Descobrir um
problema de conexão, permissão ou tipo de coluna agora custa uma tarde; descobrir
depois do Studio custa muito mais. Precisa da sua autorização para rodar as
migrations.

**Segundo: fechar os 9 testes obrigatórios que faltam.** Quatro deles —
restaurar partida, retomar combate, aventura inválida não publica, nova versão
não afeta partidas antigas — são exatamente os que provariam que a Fase 3 está
correta. Os outros cinco exigem banco: acesso entre usuários, requisições
simultâneas, migrations fora do schema. Então este passo e o anterior são o mesmo
trabalho, visto de dois ângulos.

**Terceiro: completar a Fase 4.** São acréscimos ao contrato (resistências,
vulnerabilidades, comportamento, efeitos temporários, categorias de item,
ação Defender) e, sendo contrato, mexem no JSON Schema. Melhor fazer antes de o
Studio ter um editor que dependa da forma do documento — mudar o contrato depois
custa mudar o editor também.

**Quarto: Fase 5, o Studio.** O maior bloco de trabalho restante, e o que mais
aproxima a plataforma do objetivo: criar aventuras sem escrever JSON à mão.

**Quinto: Fase 6**, narração e imagens. **Sexto: Fase 7**, implantação.

---

## 16. Riscos técnicos e decisões arquiteturais

### Riscos

**O banco compartilhado é o maior deles.** Mitigado por schema isolado,
migrations idempotentes e escritas à mão, `synchronize` desligado, `down` que não
remove schema com objetos alheios e credenciais separadas. **Risco residual:** um
`GRANT` amplo demais ao usuário da aplicação anularia o isolamento por fora do
código. Por isso os privilégios mínimos estão documentados em
[`banco-de-dados.md`](banco-de-dados.md).

**Snapshot JSON pode crescer.** Uma partida longa acumula `visitedNodes`,
`takenChoices` e `consumedEffects`. Hoje são listas; numa aventura de centenas de
nós, o snapshot pode chegar a algumas centenas de KB. `NVARCHAR(MAX)` aguenta,
mas o custo de ler e gravar a cada ação cresce. **Mitigação se aparecer:** mover
`consumedEffects` para tabela própria, indexada por partida. Não antecipei isso
porque seria otimização sem medida — diretriz 26.16.

**O contrato JSON é grande e mantido à mão.** Mil linhas de JSON Schema que
precisam concordar com os tipos TypeScript. **Mitigado** pela asserção de
exaustividade e pelo teste de contrato, que falham no build e no CI.

**Conteúdo de aventura é entrada não confiável.** Mitigado: nada de `eval`,
parser de dados estrito com limites, tipos desconhecidos falham fechados, e o
React escapa o texto narrativo por padrão. **Risco residual:** se algum dia o
texto narrativo aceitar Markdown ou HTML, isso vira um vetor de XSS e exigirá
sanitização explícita.

**Sessões em `localStorage`.** O token de acesso vive só em memória, mas o de
renovação é persistido e um XSS o alcançaria. Mitigado por TTL curto, rotação a
cada uso e revogação de família ao detectar reuso. **Evolução proposta:** cookie
`httpOnly`, `SameSite=Strict`, com CSRF por double-submit. É mudança de
transporte, não de modelo.

**Nada foi executado contra SQL Server.** O risco mais concreto da entrega atual.
Primeiro item da ordem recomendada.

### Decisões que merecem seu aval

| Decisão | Alternativa descartada | Por que |
|---|---|---|
| Motor em pacote sem framework | serviço NestJS | testável sem banco nem HTTP; reutilizável por outros clientes |
| Condições avaliadas só no servidor | avaliação no cliente para resposta instantânea | cliente modificado destravaria escolhas |
| Snapshot JSON + projeção relacional | normalização completa | o motor manipula o estado como unidade; SQL ganha onde importa |
| Migration escrita à mão | `migration:generate` | geração automática pode propor alterações em objetos de outras aplicações |
| scrypt (`node:crypto`) | bcrypt / argon2 nativos | sem módulo nativo para compilar; sem dependência extra |
| PRNG com semente, estado `{seed, cursor}` | `Math.random` | testes determinísticos e partidas auditáveis |
| `engine` como pacote único | três pacotes (engine, schema, types) | evita dependência circular; divergência coberta por teste |
| Grafo do Studio reimplementado no web | importar `outgoingNodeIds` do motor | evita levar o validador e o JSON Schema para o navegador; é leitura de apresentação, tolerante a rascunho incompleto |

---

## 17. Matriz de conformidade com as seções 9 a 27

| Seção | Status | O que falta |
|---|---|---|
| 9 — Sistema de RPG configurável | **Pronto** | — |
| 10 — Combate | **Parcial** | resistências, vulnerabilidades, comportamento; ação Defender; usar equipamento no turno; efeitos temporários |
| 11 — Itens e inventário | **Parcial** | categorias `tool`, `magical`, `material`, `special`; semântica de "entregar item" |
| 12 — NPCs, diálogos e mercadores | **Parcial** | personalidade, inventário do NPC, missões vinculadas; diálogo ramificado com estado próprio |
| 13 — Missões | **Pronto** | — |
| 14 — Autenticação e contas | **Parcial** | recuperação de senha; gerenciamento de perfil |
| 15 — Persistência e salvamento | **Pronto** / não verificado | executar contra banco |
| 16 — Adventure Studio | **Parcial** | ver seção 13 acima |
| 17 — Imagens | **Não feito** | upload, Azure Blob, categorias de mídia |
| 18 — Narração por voz | **Não feito** | TTS do navegador, controles, abstração para Azure Speech, áudio pré-gravado |
| 19 — Experiência do jogador | **Parcial** | controles de narração; classes permitidas no catálogo |
| 20 — Meta Quest e WebXR | **Não feito** | correto: fora do MVP. Arquitetura já reserva espaço |
| 21 — Segurança | **Pronto** em quase tudo | revisão sistemática de logs |
| 22 — Aventura demonstrativa | **Pronto** | corrigida nesta entrega: nome e introdução |
| 23 — Testes automatizados | **Parcial** — 5 de 14 | ver abaixo |
| 24 — Estrutura do monorepo | **Parcial** | `database/scripts`, `database/seeds`, `infrastructure/` |
| 25 — Etapas | **Fases 1–4** | ver seção 15 |
| 26 — Diretrizes | Respeitadas, com uma ressalva | 26.13: avancei quatro fases de uma vez |
| 27 — Entregáveis | **Parcial** | narração, imagens, guia de implantação, guia de criação |

### Os 14 testes obrigatórios da seção 23

| # | Cenário | Status |
|---|---|---|
| 1 | Jogador sem corda não usa escolha que exige corda | **Pronto** |
| 2 | Jogador com corda usa a escolha | **Pronto** |
| 3 | Compra válida desconta ouro e concede item | **Pronto** |
| 4 | Compra inválida não altera o estado | **Pronto** |
| 5 | Recompensa não é concedida duas vezes | **Pronto** |
| 6 | Personagem não utiliza habilidades proibidas | Não feito — `assertSkillUsable` existe, sem teste |
| 7 | Jogador não manipula resultados de combate | Não feito — rolagens são do servidor, sem teste |
| 8 | Partida salva pode ser restaurada | Não feito |
| 9 | Combate interrompido pode ser retomado | Não feito |
| 10 | Aventura inválida não pode ser publicada | Não feito — validação testada, fluxo de publicação não |
| 11 | Nova versão não modifica partidas anteriores | Não feito |
| 12 | Jogador não acessa partidas de outros usuários | Não feito |
| 13 | Requisições simultâneas não duplicam ações | Não feito — `expectedSequence` testado, concorrência real não |
| 14 | Migrations não modificam objetos fora do schema `lonetale` | Não feito |

Os testes 1 a 5 existem porque exercitam o motor, que não precisa de
infraestrutura. Os testes 8 a 14 exigem um banco: são a razão de a verificação
contra SQL Server ser o primeiro item da ordem recomendada.

---

## 18. O que peço aprovação para fazer

1. **Executar as migrations contra o seu SQL Server** — requer autorização
   expressa, conforme a seção 28. Preciso dos dados de conexão em `.env` e da
   confirmação de que o schema `lonetale` pode ser criado (ou que você o criou).
2. **Fechar os 9 testes obrigatórios restantes**, incluindo os de integração.
3. **Ajustar a estrutura** com `database/scripts`, `database/seeds` e
   `infrastructure/`.
4. **Completar a Fase 4** — as mudanças de contrato, antes de o Studio depender
   da forma do documento.
5. Depois, **Fase 5 (Studio)**, **Fase 6 (narração e imagens)** e
   **Fase 7 (implantação)**, uma por vez.

Minha recomendação é começar por 1 e 2 juntos, porque são o mesmo trabalho visto
de dois ângulos, e porque validam tudo o que já foi construído.
