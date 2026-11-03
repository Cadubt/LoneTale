# LoneTale

**Onde você vive sua própria lenda.**

Plataforma web de aventuras solo de RPG narrativo, do ecossistema **TavernTale**.
Inspirada nos livros-jogo clássicos: o jogador lê uma situação, decide, e a
história responde.

> Um jogador. Infinitas aventuras. Incontáveis destinos.

O LoneTale é uma **plataforma extensível**, não um jogo único. Administradores
criam aventuras completas em JSON — mundos, épocas, gêneros e sistemas de regras
diferentes — **sem alterar o código da aplicação**.

---

## Estado atual

As **fases 1 a 4** do roteiro de desenvolvimento estão construídas; as **fases 5
a 8**, parcial ou não iniciadas. O quadro honesto, fase por fase e requisito por
requisito, está em **[`docs/planejamento-tecnico.md`](docs/planejamento-tecnico.md)**
— inclusive a matriz de conformidade e os 14 testes obrigatórios.

| Componente | Situação |
|---|---|
| **Adventure Engine** (`packages/engine`) | Pronto — 57 testes |
| **Contrato JSON + validação** | Pronto — JSON Schema 2020-12 + validação semântica |
| **API REST + Swagger** | Pronto — auth, catálogo, Studio, partidas, telemetria |
| **Persistence Layer** | Escrito e tipado, **nunca executado contra um banco** |
| **LoneTale Player** (`apps/web`) | Pronto — catálogo, criação de personagem, jogo, combate, comércio |
| **Adventure Studio** | Parcial — importa, valida, publica e desenha o mapa; **sem edição visual, editor JSON decente ou simulador** |
| **Combate** | Parcial — faltam resistências, vulnerabilidades, comportamento, ação Defender e efeitos temporários |
| **Imagens e narração por voz** | Não feito |
| **WebXR / Meta Quest** | Não iniciado — fora do MVP por decisão; a arquitetura reserva espaço |

Dois pontos que valem destaque, porque mudam o que você pode concluir do resto:

**Nada rodou contra um SQL Server.** As migrations e a camada de persistência
não foram validadas contra um banco, e nenhuma migration foi executada em lugar
nenhum. O motor, sim — ele roda sem banco e sem frontend.

**Cobertura de testes: 5 dos 14 cenários obrigatórios.** Os cinco que existem
são os que exercitam o motor. Os outros nove precisam de banco.

---

## Arquitetura

Quatro componentes, que evoluem de forma independente:

```
┌─────────────────────────────────────────────────────────────────┐
│  LoneTale Player + Adventure Studio   (apps/web, React + Vite)  │
│  Renderiza o que o servidor projeta. Não avalia regras.         │
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST + JWT
┌──────────────────────────────▼──────────────────────────────────┐
│  API  (apps/api, NestJS)                                        │
│  Autenticação · Studio · Catálogo · Execução autoritativa       │
└──────────────┬────────────────────────────────┬─────────────────┘
               │                                │
┌──────────────▼──────────────────┐  ┌──────────▼─────────────────┐
│  Adventure Engine               │  │  Persistence Layer         │
│  (packages/engine, TS puro)     │  │  TypeORM → SQL Server      │
│  Interpreta o JSON e executa    │  │  schema `lonetale`         │
│  as regras. Sem HTTP, sem SQL.  │  │  snapshots + relacional    │
└─────────────────────────────────┘  └────────────────────────────┘
```

Três decisões sustentam o resto:

1. **O motor é autoritativo e vive fora do framework.** `packages/engine` não
   conhece HTTP, NestJS nem banco de dados. Recebe um estado e uma ação, devolve
   um novo estado, os eventos ocorridos e a projeção para o cliente. Isso o torna
   testável de verdade e reutilizável (API, CLI, simulações do Studio).
2. **O frontend não tem lógica de regra.** As condições são avaliadas no
   servidor e chegam prontas como `available` + `blockedReason`. Um cliente
   modificado não consegue destravar uma escolha.
3. **Nenhuma condicional de história no código.** A ponte quebrada do exemplo —
   corda, levitação, combate, voltar — está inteira no JSON. O motor só interpreta.

Detalhes: [`docs/arquitetura.md`](docs/arquitetura.md).

---

## Tecnologias

**Frontend** React 18 · TypeScript · Vite 5 · Tailwind CSS 3 · React Router 6 ·
TanStack Query 5 · Zustand · React Flow (`@xyflow/react`)

**Backend** Node.js · TypeScript · NestJS 10 · TypeORM 0.3 · REST ·
Swagger/OpenAPI · JWT com rotação de sessão · Google OpenID Connect

**Banco** Microsoft SQL Server (driver `mssql`), exclusivamente no schema `lonetale`

---

## Começando

### Pré-requisitos

- Node.js 20+ (desenvolvido em 20.0.0)
- Um **SQL Server existente** e um **banco de dados existente** aos quais você
  possa conectar. O LoneTale não cria servidor nem banco.

### 1. Instalar

```bash
npm install
```

### 2. Configurar

```bash
cp .env.example .env
```

Preencha os dados do SQL Server e gere os segredos JWT:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 3. Criar a estrutura no banco

O schema `lonetale` precisa existir. Crie-o uma vez, com um usuário que tenha
permissão:

```sql
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'lonetale')
  EXEC('CREATE SCHEMA [lonetale]');
```

Depois aplique as migrations:

```bash
npm run build:engine
npm run migration:run
```

### 4. Semear dados de desenvolvimento (opcional)

Cria um autor, um jogador e importa a aventura de exemplo já publicada:

```bash
npm run seed -w @lonetale/api
```

Contas criadas — **apenas para desenvolvimento local**:
`autor@lonetale.local` e `jogador@lonetale.local`, senha `lonetale-dev-2026`.

### 5. Rodar

```bash
npm run dev:api   # http://localhost:3333/api  (docs em /api/docs)
npm run dev:web   # http://localhost:5173
```

---

## Comandos

| Comando | O que faz |
|---|---|
| `npm test` | Testes do motor de aventuras |
| `npm run typecheck` | Verificação de tipos em todos os pacotes |
| `npm run build` | Compila motor, API e frontend |
| `npm run migration:run` | Aplica as migrations no schema `lonetale` |
| `npm run migration:revert` | Desfaz a última migration |
| `npm run seed -w @lonetale/api` | Semeia dados de desenvolvimento |

Validar uma aventura pela linha de comando (útil em CI):

```bash
npm run build:engine
node packages/engine/dist/cli/validate-adventure.js adventures/ponte-das-sombras/aventura.json
```

---

## Criando uma aventura

Uma aventura é um grafo direcionado de nós narrativos, declarado em JSON e
validado contra um contrato versionado. O exemplo completo e comentado está em
[`adventures/ponte-das-sombras/aventura.json`](adventures/ponte-das-sombras/aventura.json)
— ele implementa exatamente a cena da ponte do projeto original:

```json
{
  "id": "usar-corda",
  "label": "Usar a corda para atravessar o vão",
  "conditions": { "type": "hasItem", "itemId": "corda" },
  "unavailableBehavior": "disable",
  "unavailableLabel": "Você precisaria de uma corda.",
  "target": { "kind": "node", "nodeId": "travessia-com-corda" }
}
```

Um explorador começa com corda e vê a opção liberada. Um mago vê a corda
bloqueada e a levitação disponível (custa 5 de mana, debitados atomicamente). Um
guerreiro, sem nenhuma das duas, enfrenta o guardião ou volta pela floresta.
Tudo isso está no JSON — e é verificado por testes.

O guia do formato está em [`docs/aventuras-json.md`](docs/aventuras-json.md). O
JSON Schema fica disponível em `GET /api/adventures/schema` e no arquivo
[`packages/engine/src/schema/adventure.schema.json`](packages/engine/src/schema/adventure.schema.json).

---

## Garantias que o sistema oferece

**Recompensas não duplicam.** Três camadas: `mode: "once"` nos efeitos (chave
persistida por partida), `expectedSequence` em cada ação (concorrência otimista)
e `idempotencyKey` com índice único no banco. Recarregar a página, reenviar a
requisição ou reconectar não concede o mesmo tesouro duas vezes.

**Versões publicadas são imutáveis.** Uma partida iniciada na 1.0 continua lendo
a 1.0 depois de a 1.1 ser publicada. Editar exige abrir uma nova versão.

**As rolagens são do servidor e reproduzíveis.** PRNG com semente (`sfc32`); o
estado guardado é só `{ seed, cursor }`. Com a semente e o log de eventos, a
partida inteira se reconstrói — e os testes rodam de forma determinística.

**Conteúdo não executa código.** Condições e efeitos são declarativos, avaliados
por correspondência de tipo. Não há `eval`, `Function` nem interpretação de
expressões vindas do JSON.

**O banco compartilhado é respeitado.** Tudo no schema `lonetale`, nada em `dbo`,
`synchronize` sempre desligado, migrations versionadas com a tabela de controle
dentro do próprio schema, e nenhuma operação destrutiva sobre objetos alheios.

---

## Estrutura do repositório

```
packages/engine/        Adventure Engine — o núcleo
  src/types/            Contrato: aventura, estado, condições, efeitos, eventos
  src/schema/           JSON Schema 2020-12 (fonte única do contrato estrutural)
  src/validation/       Validação estrutural + semântica
  src/conditions/       Avaliador declarativo
  src/effects/          Aplicador transacional, com idempotência
  src/combat/           Combate por rodadas
  src/engine/           Orquestrador (ações, navegação, morte, finais)
  src/view/             Projeção para o cliente
  src/__tests__/        57 testes

apps/api/               API NestJS
  src/database/         DataSource, migrations, semeadura
  src/auth/             JWT com rotação, scrypt, Google OIDC
  src/adventures/       Studio, catálogo, versionamento imutável
  src/game/             Execução transacional das partidas

apps/web/               Player + Studio (React)
adventures/             Aventura demonstrativa "A Ponte das Sombras"
docs/                   Planejamento técnico, arquitetura, banco, JSON, segurança
```

---

## Licença

Proprietário — Cadubt Entertainment / TavernTale.
