/* =============================================================================
   LoneTale — schema e usuários no banco compartilhado
   =============================================================================

   Contexto: o LoneTale divide o banco com outras aplicações (o Questiário vive
   no schema `quest`). Este script cria apenas o que é do LoneTale e deixa o
   resto intocado.

   ONDE EXECUTAR
     Conectado ao banco de dados da aplicação (ex.: CaduLabDB) — NÃO no master,
     com o usuário administrador do servidor.

   COMO EXECUTAR
     Rode o arquivo INTEIRO de uma vez ("Execute script", não "Execute
     statement"): há variáveis declaradas num ponto e usadas adiante.

     Não há `GO` aqui de propósito. `GO` não é comando T-SQL, é separador de
     lote que só o SSMS, o sqlcmd e o Azure Data Studio entendem — clientes
     como DBeaver e DataGrip devolvem "Incorrect syntax near 'GO'". Sem ele,
     o script roda em qualquer um dos dois mundos.

   ANTES DE EXECUTAR
     1. Troque as duas senhas marcadas com <TROQUE...>. Para gerar:
          node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
     2. Libere o seu IP no firewall do servidor SQL
        (SQL Server > Rede > Regras de firewall).

   O QUE ELE FAZ
     - cria o schema `lonetale`, se não existir;
     - cria dois usuários contidos (contained users, o modelo do Azure SQL):
         lonetale_app       -> só lê e escreve dentro do schema (a aplicação)
         lonetale_migrator  -> também altera estrutura (as migrations)
     - nega explicitamente acesso aos schemas das outras aplicações, para que
       um defeito no LoneTale não consiga tocar nos dados delas.

   É idempotente: rodar de novo não duplica nada.
============================================================================= */

SET NOCOUNT ON;

/* ---------------------------------------------------------------- 1. schema */
/* CREATE SCHEMA precisa ser a única instrução do seu lote. O EXEC resolve isso
   sem depender de `GO`.                                                       */
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'lonetale')
BEGIN
    EXEC('CREATE SCHEMA [lonetale] AUTHORIZATION [dbo]');
    PRINT 'Schema [lonetale] criado.';
END
ELSE
    PRINT 'Schema [lonetale] ja existia.';

/* ------------------------------------------------- 2. usuário da aplicação */
/* Menor privilégio: lê e escreve, mas não cria nem altera tabela nenhuma.
   É com este usuário que a API roda no dia a dia.                            */
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'lonetale_app')
BEGIN
    CREATE USER [lonetale_app] WITH PASSWORD = '<TROQUE_SENHA_DA_APLICACAO>';
    PRINT 'Usuario [lonetale_app] criado.';
END
ELSE
    PRINT 'Usuario [lonetale_app] ja existia.';

/* ------------------------------------------------ 3. usuário das migrations */
/* Separado de propósito: só ele pode alterar estrutura, e só dentro do
   schema `lonetale`. As credenciais dele não ficam na aplicação.             */
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'lonetale_migrator')
BEGIN
    CREATE USER [lonetale_migrator] WITH PASSWORD = '<TROQUE_SENHA_DO_MIGRATOR>';
    PRINT 'Usuario [lonetale_migrator] criado.';
END
ELSE
    PRINT 'Usuario [lonetale_migrator] ja existia.';

/* --------------------------------------------------------- 4. permissões */
/* Via EXEC de propósito: o schema e os usuários podem ter acabado de nascer
   neste mesmo lote, e assim a resolução dos nomes acontece na execução, não
   na compilação do lote inteiro.                                            */
EXEC('
    GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[lonetale] TO [lonetale_app];
    GRANT EXECUTE                        ON SCHEMA::[lonetale] TO [lonetale_app];

    GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[lonetale] TO [lonetale_migrator];
    GRANT ALTER, CONTROL                 ON SCHEMA::[lonetale] TO [lonetale_migrator];
    GRANT CREATE TABLE                   TO [lonetale_migrator];
');

PRINT 'Permissoes concedidas no schema [lonetale].';

/* ------------------------------------- 5. isolamento dos outros aplicativos */
/* O banco é compartilhado. Estas negações transformam "o LoneTale não deve
   tocar nos dados das outras aplicações" de combinação em garantia: mesmo um
   defeito ou uma query errada esbarra na permissão.

   Acrescente o nome de cada schema de outra aplicação na lista do IN.        */
DECLARE @denies NVARCHAR(MAX) = N'';

SELECT @denies = @denies
     + N'DENY SELECT, INSERT, UPDATE, DELETE, ALTER ON SCHEMA::['
     + s.name + N'] TO [lonetale_app], [lonetale_migrator];' + CHAR(10)
  FROM sys.schemas s
 WHERE s.name IN ('dbo', 'quest');

IF LEN(@denies) > 0
BEGIN
    EXEC sp_executesql @denies;
    PRINT 'Acesso negado aos schemas das outras aplicacoes.';
END
ELSE
    PRINT 'Nenhum outro schema de aplicacao encontrado.';

/* ------------------------------------------------------------ 6. conferência */
SELECT name AS schema_existente
  FROM sys.schemas
 WHERE name IN ('lonetale', 'quest', 'dbo')
 ORDER BY name;

SELECT USER_NAME(p.grantee_principal_id) AS usuario,
       p.state_desc                      AS estado,
       p.permission_name                 AS permissao,
       SCHEMA_NAME(p.major_id)           AS no_schema
  FROM sys.database_permissions p
 WHERE USER_NAME(p.grantee_principal_id) IN ('lonetale_app', 'lonetale_migrator')
   AND p.class_desc = 'SCHEMA'
 ORDER BY usuario, no_schema, permissao;

/* =============================================================================
   PRÓXIMO PASSO
     Preencha o .env na raiz do repositório com estas credenciais e rode:
       npm run migration:run
     As tabelas serão criadas dentro de [lonetale], junto com a tabela de
     controle [lonetale].[MigrationHistory].
============================================================================= */
