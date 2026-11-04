/* =============================================================================
   LoneTale — schema e usuários no banco compartilhado
   =============================================================================

   Contexto: o LoneTale divide o banco com outras aplicações (o Questiário vive
   no schema `quest`). Este script cria apenas o que é do LoneTale e deixa o
   resto intocado.

   ONDE EXECUTAR
     Conectado ao banco de dados da aplicação (ex.: CaduLabDB) — NÃO no master.
     No portal do Azure: SQL Database > Editor de Consultas, ou por SSMS /
     Azure Data Studio com o usuário administrador do servidor.

   ANTES DE EXECUTAR
     1. Troque as duas senhas marcadas com <TROQUE...>. Gere senhas fortes:
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
GO

/* ---------------------------------------------------------------- 1. schema */
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'lonetale')
BEGIN
    EXEC('CREATE SCHEMA [lonetale] AUTHORIZATION [dbo]');
    PRINT 'Schema [lonetale] criado.';
END
ELSE
    PRINT 'Schema [lonetale] já existia.';
GO

/* ------------------------------------------------- 2. usuário da aplicação */
/* Menor privilégio: lê e escreve, mas não cria nem altera tabela nenhuma.
   É com este usuário que a API roda no dia a dia.                            */
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'lonetale_app')
BEGIN
    CREATE USER [lonetale_app] WITH PASSWORD = '<TROQUE_SENHA_DA_APLICACAO>';
    PRINT 'Usuário [lonetale_app] criado.';
END
ELSE
    PRINT 'Usuário [lonetale_app] já existia.';
GO

GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[lonetale] TO [lonetale_app];
GRANT EXECUTE                        ON SCHEMA::[lonetale] TO [lonetale_app];
GO

/* ------------------------------------------------ 3. usuário das migrations */
/* Separado de propósito: só ele pode alterar estrutura, e só dentro do
   schema `lonetale`. As credenciais dele não ficam na aplicação.             */
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'lonetale_migrator')
BEGIN
    CREATE USER [lonetale_migrator] WITH PASSWORD = '<TROQUE_SENHA_DO_MIGRATOR>';
    PRINT 'Usuário [lonetale_migrator] criado.';
END
ELSE
    PRINT 'Usuário [lonetale_migrator] já existia.';
GO

GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[lonetale] TO [lonetale_migrator];
GRANT ALTER, CONTROL                 ON SCHEMA::[lonetale] TO [lonetale_migrator];
GRANT CREATE TABLE                   TO [lonetale_migrator];
GO

/* ------------------------------------- 4. isolamento dos outros aplicativos */
/* O banco é compartilhado. Estas negações transformam "o LoneTale não deve
   tocar nos dados das outras aplicações" de combinação em garantia: mesmo um
   defeito ou uma query errada esbarra na permissão.

   Acrescente uma linha para cada schema de outra aplicação que existir.       */
DECLARE @outros TABLE (nome SYSNAME);
INSERT INTO @outros (nome) VALUES ('dbo'), ('quest');

DECLARE @schema SYSNAME, @sql NVARCHAR(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT o.nome FROM @outros o
    WHERE EXISTS (SELECT 1 FROM sys.schemas s WHERE s.name = o.nome);

OPEN cur;
FETCH NEXT FROM cur INTO @schema;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'DENY SELECT, INSERT, UPDATE, DELETE, ALTER ON SCHEMA::['
             + @schema + N'] TO [lonetale_app], [lonetale_migrator];';
    EXEC sp_executesql @sql;
    PRINT 'Acesso negado ao schema [' + @schema + '].';
    FETCH NEXT FROM cur INTO @schema;
END
CLOSE cur;
DEALLOCATE cur;
GO

/* ------------------------------------------------------------ 5. conferência */
PRINT '';
PRINT '--- Schemas do banco ---';
SELECT name AS schema_existente
  FROM sys.schemas
 WHERE name IN ('lonetale', 'quest', 'dbo')
 ORDER BY name;

PRINT '--- Permissões do LoneTale ---';
SELECT USER_NAME(p.grantee_principal_id) AS usuario,
       p.state_desc                      AS estado,
       p.permission_name                 AS permissao,
       SCHEMA_NAME(p.major_id)           AS no_schema
  FROM sys.database_permissions p
 WHERE USER_NAME(p.grantee_principal_id) IN ('lonetale_app', 'lonetale_migrator')
   AND p.class_desc = 'SCHEMA'
 ORDER BY usuario, no_schema, permissao;
GO

/* =============================================================================
   PRÓXIMO PASSO
     Preencha o .env na raiz do repositório com estas credenciais e rode:
       npm run migration:run
     As tabelas serão criadas dentro de [lonetale], junto com a tabela de
     controle [lonetale].[MigrationHistory].
============================================================================= */
