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

## Preparando o banco

Tudo o que exige privilégio de administrador está em
[`database/scripts/`](../database/scripts). São dois arquivos, e a aplicação
nunca precisa dessas permissões:

| Script | Faz |
|---|---|
| `01-schema-e-usuarios.sql` | cria o schema `lonetale` e os dois usuários |
| `99-remover.sql` | desfaz tudo o que é do LoneTale, e nada além |

Execute o primeiro **uma vez**, conectado ao banco da aplicação (não ao
`master`), com o administrador do servidor. Ele é idempotente.

Depois disso o caminho é só:

```
1. 01-schema-e-usuarios.sql    (admin, uma vez)
2. preencher o .env
3. npm run migration:run
```

A aplicação **não** cria o schema por conta própria: `DB_ALLOW_SCHEMA_CREATION`
vem desligado. Em banco compartilhado, criar schema é um ato deliberado de quem
administra o banco, não efeito colateral de subir um processo. Faltando o
schema, o `SchemaBootstrapService` registra a instrução no log e segue — em vez
de improvisar.

## Privilégios

Dois usuários, com papéis distintos:

| Usuário | Pode | Usado por |
|---|---|---|
| `lonetale_app` | ler e escrever no schema `lonetale` | a API, o tempo todo |
| `lonetale_migrator` | o acima, mais alterar estrutura | só as migrations |

As credenciais do migrator vão em `DB_ADMIN_USERNAME` / `DB_ADMIN_PASSWORD`, e
são usadas **apenas** por `buildDataSourceOptions(..., { forMigrations: true })`.
Se você omitir, as migrations caem para as credenciais da aplicação — o que faz
a API rodar o tempo todo com permissão de derrubar tabela. Vale separar.

### Isolamento garantido pelo banco, não por disciplina

O script nega explicitamente, aos dois usuários, acesso aos schemas das outras
aplicações:

```sql
DENY SELECT, INSERT, UPDATE, DELETE, ALTER ON SCHEMA::[quest] TO [lonetale_app];
```

A diretriz "não modificar tabelas de outras aplicações" deixa de depender de
code review e passa a esbarrar na permissão. Se o banco ganhar um schema novo
de outro sistema, acrescente-o à lista no início do script.

## Azure SQL Database

O cenário em produção é um Azure SQL compartilhado. Três diferenças em relação
a um SQL Server local:

**Usuários contidos.** No Azure SQL não se cria login no servidor para este
caso; cria-se o usuário dentro do banco, com senha própria
(`CREATE USER ... WITH PASSWORD`). É o que o script faz.

**`DB_TRUST_SERVER_CERTIFICATE=false`.** O certificado do Azure é válido e
emitido por autoridade reconhecida. Deixar `true` ali desliga a validação e
abre espaço para interceptação — `true` só faz sentido contra um servidor local
com certificado autoassinado.

**Firewall.** O servidor bloqueia tudo por padrão. Libere:
- o seu IP, para rodar migrations da sua máquina
  (SQL Server → Rede → Regras de firewall);
- "Permitir que serviços e recursos do Azure acessem este servidor", para a API
  quando ela estiver hospedada lá.

Sobre camada de serviço: a Básica entrega 5 DTUs e 2 GB. Para desenvolvimento e
para as primeiras partidas é suficiente, mas vale saber o que pressiona esse
limite — cada ação do jogador grava o snapshot da partida e algumas linhas de
evento, numa transação. Dividindo os mesmos 5 DTUs com outras aplicações, o
gargalo aparece primeiro em escrita concorrente, não em espaço.

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
