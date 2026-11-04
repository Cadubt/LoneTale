# Scripts SQL

O que não é TypeScript e precisa ser executado por um administrador do banco.
As alterações de estrutura do LoneTale **não** moram aqui — elas são migrations
versionadas em [`apps/api/src/database/migrations`](../../apps/api/src/database/migrations).

| Script | Quando rodar | Com qual usuário |
|---|---|---|
| [`01-schema-e-usuarios.sql`](01-schema-e-usuarios.sql) | uma vez, antes da primeira migration | administrador do servidor |
| [`99-remover.sql`](99-remover.sql) | só para desfazer tudo | administrador do servidor |

## Por que isto é separado das migrations

As migrations rodam com um usuário de permissões limitadas, que só mexe dentro
do schema `lonetale`. Criar o schema e os próprios usuários exige privilégios
que esse usuário não tem — e não deve ter.

É a mesma razão pela qual o `DB_ALLOW_SCHEMA_CREATION` vem desligado por padrão:
num banco compartilhado, criar schema é um ato deliberado de quem administra o
banco, não um efeito colateral de subir a aplicação.

## Ordem completa, do zero

```
1. 01-schema-e-usuarios.sql     (admin, no portal ou SSMS)
2. preencher o .env             (credenciais criadas no passo 1)
3. npm run migration:run        (cria as tabelas)
4. npm run seed -w @lonetale/api   (opcional: dados de desenvolvimento)
```
