/* =============================================================================
   LoneTale — remoção completa do banco compartilhado
   =============================================================================

   Desfaz o que o LoneTale criou e **nada além disso**. Serve para abandonar a
   aplicação sem deixar resíduo, ou para recomeçar do zero em desenvolvimento.

   ATENÇÃO: apaga todas as contas, aventuras e partidas do LoneTale.
   As outras aplicações do banco (dbo, quest, ...) não são tocadas.

   A forma preferida de desfazer a ESTRUTURA é a migration:
       npm run migration:revert
   Este script existe para o caso de o schema precisar sair inteiro, incluindo
   os usuários — coisa que a migration não faz nem deve fazer.

   Execute conectado ao banco da aplicação, como administrador, rodando o
   arquivo INTEIRO de uma vez. Sem `GO`, para funcionar também em clientes que
   não entendem esse separador (DBeaver, DataGrip).
============================================================================= */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ------------------------------------------- 1. tabelas, na ordem das FKs */
DECLARE @sql NVARCHAR(MAX) = N'';

/* Primeiro as chaves estrangeiras: assim a ordem de exclusão das tabelas
   deixa de importar. */
SELECT @sql = @sql + N'ALTER TABLE [lonetale].[' + OBJECT_NAME(fk.parent_object_id)
            + N'] DROP CONSTRAINT [' + fk.name + N'];' + CHAR(10)
  FROM sys.foreign_keys fk
  JOIN sys.schemas s ON s.schema_id = fk.schema_id
 WHERE s.name = 'lonetale';

SELECT @sql = @sql + N'DROP TABLE [lonetale].[' + t.name + N'];' + CHAR(10)
  FROM sys.tables t
  JOIN sys.schemas s ON s.schema_id = t.schema_id
 WHERE s.name = 'lonetale';

IF LEN(@sql) > 0
BEGIN
    EXEC sp_executesql @sql;
    PRINT 'Tabelas do schema [lonetale] removidas.';
END
ELSE
    PRINT 'Nenhuma tabela a remover em [lonetale].';

/* ------------------------------------------------------------- 2. o schema */
/* Só sai se estiver vazio — se sobrou algo que não era nosso, o schema fica. */
IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'lonetale')
   AND NOT EXISTS (
        SELECT 1 FROM sys.objects o
          JOIN sys.schemas s ON s.schema_id = o.schema_id
         WHERE s.name = 'lonetale')
BEGIN
    EXEC('DROP SCHEMA [lonetale]');
    PRINT 'Schema [lonetale] removido.';
END
ELSE
    PRINT 'Schema [lonetale] mantido (inexistente ou ainda com objetos).';

/* ----------------------------------------------------------- 3. usuários */
IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'lonetale_app')
BEGIN
    DROP USER [lonetale_app];
    PRINT 'Usuario [lonetale_app] removido.';
END

IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'lonetale_migrator')
BEGIN
    DROP USER [lonetale_migrator];
    PRINT 'Usuario [lonetale_migrator] removido.';
END

/* ----------------------------------------------------------- 4. conferência */
SELECT name AS schema_restante
  FROM sys.schemas
 WHERE name NOT IN ('sys','INFORMATION_SCHEMA','guest','db_owner','db_accessadmin',
                    'db_securityadmin','db_ddladmin','db_backupoperator',
                    'db_datareader','db_datawriter','db_denydatareader','db_denydatawriter')
 ORDER BY name;
