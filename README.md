# Atarefado

Gerenciador de tarefas colaborativo no estilo Kanban: crie quadros, organize as tarefas por dia, arraste cards entre colunas e atribua responsÃ¡veis para o time.

**Desenvolvido por Marlon Giovany.**

> ðŸ‡ºðŸ‡¸ A collaborative Kanban task manager with day-by-day planning, built with React, Express and Prisma.

## Funcionalidades

- **AutenticaÃ§Ã£o**: cadastro e login com e-mail e senha (bcrypt), sessÃµes no servidor em cookie `HttpOnly`, logout que realmente encerra a sessÃ£o e "Sair de todos os dispositivos"
- **Login com Google** (opcional): botÃ£o oficial "Continuar com o Google"; o servidor valida o token com o Google e identifica a conta pelo `sub`. Se jÃ¡ existir uma conta com o mesmo e-mail, o vÃ­nculo exige a senha dela
- **Esqueci minha senha**: link por e-mail, de uso Ãºnico e vÃ¡lido por 30 minutos
- **Minha conta**: criar ou trocar a senha (inclusive para contas criadas pelo Google)
- **SeguranÃ§a**: proteÃ§Ã£o CSRF, limite de tentativas, mensagens que nÃ£o revelam quais e-mails tÃªm conta e polÃ­tica de senhas. Detalhes no [relatÃ³rio de seguranÃ§a](SECURITY.md)
- **Quadros**: criar, renomear e excluir; cada quadro novo jÃ¡ vem com *A fazer / Em andamento / ConcluÃ­do*
- **OrganizaÃ§Ã£o por data**: cada tarefa pertence a um dia, e o quadro mostra sÃ³ as tarefas do dia selecionado (por padrÃ£o, hoje)
  - Seletor com a semana, a quantidade de tarefas por dia, setas de dia anterior/prÃ³ximo e calendÃ¡rio para pular para qualquer data
  - BotÃ£o **Hoje** para voltar rapidamente ao dia atual
  - O dia escolhido fica na URL (`?dia=2026-10-01`), entÃ£o recarregar a pÃ¡gina ou compartilhar o link mantÃ©m a data
- **Trazer pendentes para hoje**: tarefas de dias anteriores que ainda nÃ£o chegaram Ã  Ãºltima coluna (ex.: "ConcluÃ­do") podem ser trazidas para hoje com um clique, mantendo a coluna de cada uma; dÃ¡ para desfazer logo em seguida
- **Arrastar e soltar**: reordene cards e mova entre colunas (mouse e teclado)
- **Cards**: tÃ­tulo, descriÃ§Ã£o, data e responsÃ¡vel; mudar a data move o card para outro dia
- **ExclusÃ£o segura**: cards, colunas e quadros sÃ³ sÃ£o excluÃ­dos depois de uma confirmaÃ§Ã£o
- **ColaboraÃ§Ã£o**: o dono convida membros por e-mail; membros podem sair e o dono pode removÃª-los
- **Controle de acesso**: toda rota verifica se o usuÃ¡rio Ã© membro do quadro; quem nÃ£o Ã© recebe `404`, entÃ£o nÃ£o dÃ¡ para descobrir ids de quadros alheios

## Tecnologias

| Camada | Ferramentas |
|---|---|
| Front-end | React 19, TypeScript, Vite, Tailwind CSS 4, React Router, dnd-kit |
| Back-end | Node.js, Express 5, TypeScript, Zod (validaÃ§Ã£o), bcrypt, helmet, express-rate-limit, Nodemailer, google-auth-library |
| Banco de dados | Prisma 7 ORM, SQLite (desenvolvimento); pode ser trocado por PostgreSQL |

## Como rodar

Requisito: Node.js 20 ou superior.

```bash
# 1. API
cd server
npm install
cp .env.example .env        # as variÃ¡veis estÃ£o explicadas no prÃ³prio arquivo
npx prisma migrate dev      # cria o banco de dados
npx prisma generate
npm run db:seed             # opcional: conta demo e quadro de exemplo
npm run dev                 # http://localhost:3333

# 2. App web (em outro terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

**Conta demo** (depois do seed): `demo@atarefado.dev` / `demo12345`

### E-mails (recuperaÃ§Ã£o de senha)

Em desenvolvimento nÃ£o Ã© preciso configurar nada: os e-mails sÃ£o salvos em `server/.mail-outbox/` (abra o `.html` no navegador para clicar no link). Em produÃ§Ã£o, configure as variÃ¡veis `SMTP_*` e `MAIL_FROM` no `server/.env`; sem elas o servidor nÃ£o inicia em modo produÃ§Ã£o.

### Login com Google (opcional)

Sem configuraÃ§Ã£o o app funciona normalmente, sÃ³ sem o botÃ£o do Google. Para ativar:

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) e crie um projeto.
2. Em **Google Auth Platform** (ou "APIs e serviÃ§os â†’ Tela de consentimento OAuth"), configure o app: nome "Atarefado", e-mail de suporte e pÃºblico **Externo**. Enquanto o app estiver em modo **Teste**, adicione seu e-mail em **UsuÃ¡rios de teste**.
3. Em **Clientes** (ou "Credenciais â†’ Criar credenciais â†’ ID do cliente OAuth"), crie um cliente do tipo **Aplicativo da Web**.
4. Em **Origens JavaScript autorizadas**, adicione `http://localhost:5173` e `http://localhost`. NÃ£o Ã© preciso URI de redirecionamento.
5. Copie o **ID do cliente** (termina em `.apps.googleusercontent.com`) para `GOOGLE_CLIENT_ID` no `server/.env` e reinicie a API.

O ID do cliente nÃ£o Ã© secreto (ele aparece na pÃ¡gina); nenhuma "chave secreta do cliente" Ã© usada.

Como funciona: o botÃ£o do Google devolve um *ID token* assinado; a API confere assinatura, validade, emissor e se o token foi emitido para o nosso ID do cliente, e identifica a pessoa pelo `sub` do Google. Se nÃ£o existir conta com aquele e-mail, uma conta nova Ã© criada sem senha. Se jÃ¡ existir uma conta com senha usando o mesmo e-mail, o app pede a senha dessa conta antes de vincular o Google a ela.

## Como funcionam as datas

Cada card tem uma `date`: o dia a que a tarefa pertence. Ela trafega na API como `AAAA-MM-DD` e Ã© gravada como meia-noite UTC, entÃ£o representa o mesmo dia do calendÃ¡rio em qualquer fuso horÃ¡rio. O "hoje" vem do relÃ³gio do prÃ³prio usuÃ¡rio, e cards novos sÃ£o criados no dia que estiver selecionado na tela.

Uma tarefa Ã© **pendente** quando Ã© de um dia anterior e nÃ£o estÃ¡ na Ãºltima coluna do quadro, que por convenÃ§Ã£o do Kanban guarda o que foi concluÃ­do. Num quadro com uma sÃ³ coluna, todas as tarefas de dias anteriores contam como pendentes.

## Como funciona a ordenaÃ§Ã£o dos cards

Cada card guarda uma `position` fracionÃ¡ria. Quando um card Ã© solto entre outros dois, o front envia um valor no meio dos vizinhos (`(anterior + prÃ³ximo) / 2`). Assim sÃ³ o card movido Ã© gravado no banco, sem precisar renumerar o resto da lista.

## VisÃ£o geral da API

A sessÃ£o vai no cookie `atarefado_session` (`HttpOnly`), definido no login. Todas as rotas, exceto as de autenticaÃ§Ã£o, exigem uma sessÃ£o vÃ¡lida, e toda requisiÃ§Ã£o que altera dados precisa vir da origem do front-end (proteÃ§Ã£o CSRF).

| MÃ©todo | Rota | DescriÃ§Ã£o |
|---|---|---|
| POST | `/api/auth/register` | Criar conta (jÃ¡ inicia a sessÃ£o) |
| POST | `/api/auth/login` | Entrar |
| POST | `/api/auth/logout` | Encerrar a sessÃ£o atual |
| POST | `/api/auth/logout-all` | Encerrar todas as sessÃµes |
| GET | `/api/auth/me` | UsuÃ¡rio logado e formas de entrar (`hasPassword`, `hasGoogle`) |
| GET | `/api/auth/config` | Diz se o login com Google estÃ¡ ativo (e o ID do cliente) |
| POST | `/api/auth/google` | Entrar com o *ID token* do Google (409 `google_link_required` se o e-mail jÃ¡ tiver conta com senha) |
| POST | `/api/auth/google/link` | Confirmar a senha da conta existente e vincular o Google |
| POST | `/api/auth/forgot-password` | Pedir o e-mail de redefiniÃ§Ã£o (resposta sempre genÃ©rica) |
| POST | `/api/auth/reset-password` | Definir nova senha com o token do e-mail |
| PUT | `/api/account/password` | Criar ou trocar a senha |
| GET / POST | `/api/boards` | Listar / criar quadros |
| GET | `/api/boards/:id?date=AAAA-MM-DD` | Quadro com colunas, membros e os cards do dia |
| PATCH / DELETE | `/api/boards/:id` | Renomear / excluir quadro (excluir: dono) |
| GET | `/api/boards/:id/days?from=â€¦&to=â€¦` | Quantidade de cards por dia no intervalo |
| GET | `/api/boards/:id/pending?before=AAAA-MM-DD` | Quantidade de tarefas pendentes antes do dia |
| POST | `/api/boards/:id/pending/move` | Traz as pendentes para o dia `to`; devolve as datas originais |
| POST | `/api/boards/:id/cards/reschedule` | Muda a data de vÃ¡rios cards de uma vez (usado no "Desfazer") |
| POST | `/api/boards/:id/members` | Convidar por e-mail (dono) |
| DELETE | `/api/boards/:id/members/:userId` | Remover membro ou sair |
| POST | `/api/boards/:id/columns` | Criar coluna |
| PATCH / DELETE | `/api/columns/:id` | Renomear / excluir coluna |
| POST | `/api/columns/:id/cards` | Criar card (com `date`) |
| PATCH / DELETE | `/api/cards/:id` | Editar / excluir card |
| POST | `/api/cards/:id/move` | Mover card (coluna + posiÃ§Ã£o) |

## Estrutura do projeto

```
client/   App React (pages, components/board, lib/api, lib/dates)
server/   API Express (routes, middleware, lib) + schema, migrations e seed do Prisma
          tests/  testes de ponta a ponta da API, de seguranÃ§a e do login com Google
```

## Testes

Com a API rodando (`npm run dev` em `server/`), em outro terminal na pasta `server/`:

```bash
npm test    # 145 verificaÃ§Ãµes: rotas, controle de acesso, sessÃµes, CSRF, senhas, recuperaÃ§Ã£o de senha e Google
```

Os detalhes estÃ£o no [relatÃ³rio de seguranÃ§a](SECURITY.md).

## PrÃ³ximos passos

- [ ] SincronizaÃ§Ã£o em tempo real entre usuÃ¡rios (Socket.IO)
- [ ] ComentÃ¡rios e histÃ³rico de atividades nos cards
- [ ] VerificaÃ§Ã£o de e-mail no cadastro e autenticaÃ§Ã£o em dois fatores
- [ ] CI com GitHub Actions rodando os testes
- [ ] Deploy (Vercel + Render) com PostgreSQL
- [ ] Modo escuro

## Autor

**Marlon Giovany**

## LicenÃ§a

[MIT](LICENSE) Â© 2026 Marlon Giovany
