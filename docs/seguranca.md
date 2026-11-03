# Segurança

## Autenticação

### Senhas

Derivadas com **scrypt** (`node:crypto`), parâmetros `N=16384, r=8, p=1`, sal de
16 bytes e chave de 64 bytes. Os parâmetros viajam dentro do hash
(`scrypt$N$r$p$sal$hash`), de modo que aumentar o custo no futuro não invalida as
senhas existentes — `needsRehash()` detecta o hash defasado e a senha é
re-derivada no próximo login bem-sucedido.

A escolha de scrypt em vez de bcrypt ou argon2 é deliberada: nenhum módulo
nativo para compilar (o que costuma quebrar em Windows e em imagens enxutas),
sem dependência extra, e uma função de derivação resistente a hardware dedicado.

A comparação usa `timingSafeEqual`. Hash malformado devolve `false` em vez de
lançar.

### Login local

- Mensagem idêntica para e-mail inexistente e senha errada — não revela quais
  e-mails têm conta;
- o trabalho de derivação é feito **nos dois casos**, para que o tempo de
  resposta não distinga um do outro;
- bloqueio temporário de 15 minutos a partir da quinta tentativa falha;
- limite de taxa: 10 tentativas por minuto (`@Throttle`).

### Tokens

**Acesso** — JWT de 15 minutos, com `issuer` e `audience` verificados. A
estratégia revalida o usuário no banco a cada requisição, em vez de confiar só no
conteúdo do token: uma conta desativada perde acesso na hora, sem esperar a
expiração.

**Renovação** — segredo opaco de 48 bytes, guardado **apenas como SHA-256**. Um
vazamento da tabela não permite emitir sessões.

Cada uso **rotaciona** o token e aponta para o sucessor. Reapresentar um token já
usado é tratado como comprometimento: toda a **família** de tokens daquele login
é revogada e a pessoa precisa entrar de novo. É a defesa padrão contra roubo de
refresh token.

Trocar a senha revoga todas as sessões, em todos os aparelhos.

### Google (OpenID Connect)

Descoberta de metadados, `state` contra CSRF, `nonce` contra replay do
`id_token` e **PKCE S256**. A assinatura e as claims são verificadas pela
biblioteca contra o JWKS do Google.

O fluxo é **sem estado no servidor**: `state`, `nonce` e `code_verifier` viajam
em um JWT de 10 minutos (`flowToken`) que o cliente devolve no callback. Sem
sessão no servidor e sem abrir mão das proteções do OIDC.

Contas só são unidas por e-mail quando o provedor marca o e-mail como
**verificado** — e-mail não verificado nunca une contas.

## Autorização

O guard de autenticação é **global**: uma rota só é pública se marcada com
`@Public()`. Esquecer o guard não expõe dados — o padrão é fechado.

Papéis: `player`, `author`, `admin`. `admin` acessa tudo. O Studio exige
`author`. Além do papel, a propriedade é verificada: `assertCanEdit` recusa editar
aventura de outro autor.

Partidas de outra pessoa devolvem **404, não 403** — um 403 confirmaria que o id
existe.

## Entrada

`ValidationPipe` global com `whitelist: true` e **`forbidNonWhitelisted: true`**:
propriedade desconhecida é erro, não silêncio. O cliente descobre de imediato
que mandou um campo errado.

Todo DTO declara tipo, tamanho e formato. Documentos de aventura passam pelo
JSON Schema antes de serem gravados.

## Conteúdo de aventura não executa código

Condições e efeitos são **dados declarativos**, avaliados por correspondência de
tipo. Não há `eval`, `new Function`, template de expressão nem interpretador de
fórmulas em nenhum ponto do motor.

Expressões de dados passam por um parser estrito, com limites de 100 dados e
1000 faces. `"1d6; rm -rf /"` é recusada como expressão inválida.

Um tipo de condição desconhecido — documento de uma versão futura do contrato —
**bloqueia** a escolha em vez de liberá-la. Falha fechada.

## Integridade da partida

Nenhuma regra é decidida no cliente. O servidor avalia as condições e devolve
`available` + `blockedReason`; enviar uma escolha bloqueada direto na API é
recusado com `CHOICE_UNAVAILABLE`.

Rolagens acontecem só no servidor, com PRNG com semente. O cliente não influencia
o resultado e não consegue prevê-lo.

Contra duplicação de recompensas, três camadas independentes:
`mode: "once"` nos efeitos, `expectedSequence` por ação e `idempotencyKey` com
índice único no banco. Ver
[`arquitetura.md`](arquitetura.md#fluxo-de-uma-ação).

## Transporte e cabeçalhos

`helmet` no pipeline HTTP. CORS restrito a `CORS_ORIGINS` — sem curinga.
Conexão com o banco com `encrypt: true`; `trustServerCertificate` emite aviso
em produção, porque nesse modo a criptografia não valida o certificado do
servidor.

## Configuração

A configuração é lida e validada **uma vez, no arranque**. Faltando algo
essencial, o processo não sobe — em vez de falhar no meio de uma requisição em
produção. São erros de arranque:

- variável obrigatória ausente;
- `JWT_ACCESS_SECRET` igual a `JWT_REFRESH_SECRET`;
- em produção, segredo com menos de 32 caracteres;
- em produção, `GAME_DETERMINISTIC_SEED` definida (tornaria todas as rolagens
  previsíveis).

## Limitação de taxa

Base de 120 requisições por minuto. Rotas sensíveis apertam: registro 5/min,
login 10/min, callback do Google 10/min, renovação 30/min.

## Ponto em aberto, consciente

Os tokens voltam no **corpo** da resposta, e o de renovação é guardado no
`localStorage` pelo frontend. O token de acesso vive apenas em memória, o que
limita o estrago, mas um XSS conseguiria ler o token de renovação.

A evolução natural é entregar o refresh token em **cookie `httpOnly`,
`SameSite=Strict`, `Secure`**, com CSRF por double-submit. O que já está no
lugar para suportar essa mudança: rotação a cada uso, detecção de reuso com
revogação de família, TTL curto no acesso e revogação em massa na troca de
senha. A mudança é na camada de transporte, não no modelo.
