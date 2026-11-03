# Banco de dados

## O cenário que a arquitetura assume

O LoneTale roda sobre um **servidor SQL Server que já existe** e um **banco de
dados que já existe**, possivelmente compartilhado com outras aplicações. Isso
não é um detalhe de configuração: é um requisito que molda a camada de dados.

Em consequência, o sistema **nunca**:

- cria uma instância de SQL Server;
- cria um banco de dados;
- cria objetos em `dbo`;
- altera ou remove objetos fora do schema `lonetale`;
- roda migrations contra schemas de outros sistemas;
- usa `synchronize: true`;
- assume que o banco está vazio.

Toda a estrutura própria vive no schema **`lonetale`**, e esse isolamento é
verificado em três lugares: as entidades declaram `schema: LONETALE_SCHEMA`, o
`DataSource` fixa `schema`, e a migration prefixa cada objeto.

## Criando o schema

A aplicação não cria o schema por padrão — em banco compartilhado, criar schema
é ato deliberado do DBA:

```sql
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'lonetale')
  EXEC('CREATE SCHEMA [lonetale]');
```

Para desenvolvimento, `DB_ALLOW_SCHEMA_CREATION=true` autoriza a aplicação a
criar o schema no arranque, se ele não existir e houver permissão. Falhando,
`SchemaBootstrapService` registra uma instrução clara em vez de improvisar.

## Privilégios

Separe quem executa de quem migra.

**Usuário da aplicação** — apenas DML no schema:

```sql
CREATE USER [lonetale_app] FOR LOGIN [lonetale_app];
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::lonetale TO [lonetale_app];
-- Necessário para o SELECT ... WITH (UPDLOCK) do pipeline de ações.
GRANT VIEW DEFINITION ON SCHEMA::lonetale TO [lonetale_app];
```

**Usuário das migrations** — DDL no schema:

```sql
CREATE USER [lonetale_migrator] FOR LOGIN [lonetale_migrator];
GRANT ALTER, CONTROL ON SCHEMA::lonetale TO [lonetale_migrator];
GRANT CREATE TABLE TO [lonetale_migrator];
```

Informe as credenciais administrativas em `DB_ADMIN_USERNAME` /
`DB_ADMIN_PASSWORD`: elas são usadas **só** pelas migrations
(`buildDataSourceOptions(..., { forMigrations: true })`).

## Migrations

```bash
npm run migration:run      # aplica
npm run migration:show     # lista o que falta
npm run migration:revert   # desfaz a última
```

A tabela de controle é `lonetale.MigrationHistory` — dentro do próprio schema,
não em `dbo`.

A migration inicial é **escrita à mão**, não gerada. Isso é intencional:

- cada `CREATE TABLE` é guardado por `IF OBJECT_ID(...) IS NULL`, e cada índice
  por uma checagem em `sys.indexes`, de modo que aplicar duas vezes é seguro;
- o `down` remove apenas o que o `up` criou, na ordem inversa das chaves
  estrangeiras;
- o `DROP SCHEMA` final só acontece se **nada mais** restar no schema — se outra
  aplicação tiver criado algo lá, o schema fica.

Uma migration gerada automaticamente não daria essas garantias em um banco
compartilhado.

## Modelo

### Contas

| Tabela | Papel |
|---|---|
| `Users` | identidade (e-mail único, nome, papel, locale) |
| `UserCredentials` | derivação scrypt da senha, tentativas falhas, bloqueio temporário |
| `ExternalLogins` | vínculo com provedor OIDC, único por `(provider, subject)` |
| `RefreshTokens` | hash SHA-256 do token, família, rotação e revogação |

`UserCredentials` é separada de `Users` para que consultas de perfil não tragam
material sensível por acidente.

### Conteúdo

| Tabela | Papel |
|---|---|
| `Adventures` | identidade estável da obra (slug, autor, visibilidade) |
| `AdventureVersions` | o conteúdo: `document NVARCHAR(MAX)` + checksum + status |
| `AdventurePublications` | trilha de auditoria de publicações |
| `MediaAssets` | metadados das mídias declaradas em `assets` |

A separação entre `Adventures` e `AdventureVersions` é o que torna
**versões publicadas imutáveis**. Uma partida guarda `adventureVersionId`, então
continua lendo exatamente o documento com que começou, mesmo depois de a versão
seguinte entrar no ar.

### Partidas

| Tabela | Papel |
|---|---|
| `Characters` | ficha persistente (nome, classe, espécie, nível, **aparência**) |
| `GameSessions` | a partida: `stateSnapshot NVARCHAR(MAX)` + `sequence` + `rngSeed` |
| `GameEvents` | log autoritativo; carrega a chave de idempotência |
| `CharacterInventory` | projeção relacional do inventário |

## Snapshot JSON + tabelas relacionais

O estado da partida é guardado como **um snapshot JSON** em
`GameSessions.stateSnapshot`, não normalizado em dezenas de tabelas. A razão é
prática: o motor opera sobre um objeto `GameState` coerente, e quebrá-lo em
linhas obrigaria a remontá-lo a cada ação, com risco de divergência.

Ao lado do snapshot existem colunas e tabelas relacionais, cada uma com um
propósito que o JSON não atende bem:

- `sequence`, `status`, `updatedAt` — concorrência e índices de listagem;
- `endingId`, `playtimeSeconds` — relatórios;
- `Characters` — consultar personagens sem abrir snapshots;
- `CharacterInventory` — responder em SQL a "quantos jogadores carregam a
  corda?" ou "qual item é mais equipado?";
- `GameEvents` — auditoria, idempotência e telemetria narrativa.

A projeção relacional é reescrita **dentro da mesma transação** do snapshot, de
modo que as duas representações nunca divergem. São poucas linhas por partida.

**Não existem arquivos JSON por usuário.** Tudo vive no banco.

Constraints `CHECK (ISJSON(coluna) = 1)` garantem no banco o que a aplicação já
garante com JSON Schema — defesa em profundidade contra escrita por fora.

## Índices

Criados para as consultas que o sistema realmente faz:

```
Users                 (email) UNIQUE
ExternalLogins        (provider, subject) UNIQUE · (userId)
RefreshTokens         (tokenHash) UNIQUE · (userId, expiresAt)
Adventures            (slug) UNIQUE · (ownerId) · (status, visibility)
AdventureVersions     (adventureId, version) UNIQUE · (status)
MediaAssets           (adventureId, assetId) UNIQUE · (kind)
Characters            (userId) · (adventureId, userId)
GameSessions          (userId, status) · (userId, updatedAt DESC)
                      (adventureId, status) · (characterId)
CharacterInventory    (gameSessionId, itemId) UNIQUE · (gameSessionId) · (itemId)
GameEvents            (gameSessionId, sequence) · (kind)
                      (gameSessionId, idempotencyKey) UNIQUE WHERE NOT NULL
```

O último é um **índice único filtrado**: a chave de idempotência é opcional, mas
quando enviada o banco recusa a segunda aplicação da mesma ação — inclusive se
duas requisições chegarem ao mesmo tempo.

## Transações e concorrência

Operações que envolvem inventário, compras, recompensas, combate e progressão
acontecem em uma transação única (`GameService.applyAction`). Ver o pipeline
completo em [`arquitetura.md`](arquitetura.md#fluxo-de-uma-ação).

Duas camadas de controle de concorrência:

- **`sequence`** — número monotônico da partida. O motor recusa ações cujo
  `expectedSequence` não bate (`SEQUENCE_MISMATCH` → HTTP 409), e o `UPDATE`
  condiciona nela;
- **`version`** (`@VersionColumn`) — trava otimista do TypeORM, como rede de
  segurança para escritas por outros caminhos.

## Chaves estrangeiras

`CASCADE` apenas onde o filho não existe sem o pai e não há caminho duplo:
`UserCredentials`, `ExternalLogins` e `RefreshTokens` → `Users`;
`AdventureVersions` e `MediaAssets` → `Adventures`;
`GameEvents` e `CharacterInventory` → `GameSessions`.

As demais usam `NO ACTION`, para evitar o erro de múltiplos caminhos de cascata
do SQL Server e para que apagar uma conta não leve silenciosamente o histórico
de partidas embora.

## Datas

Todas as colunas temporais são `DATETIME2` e a conexão usa `useUTC: true`. A
conversão para o fuso do jogador acontece na interface.
