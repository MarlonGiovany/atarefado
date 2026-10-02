# Atarefado

Gerenciador de tarefas colaborativo no estilo Kanban: crie quadros, organize as tarefas por dia, arraste cards entre colunas e atribua responsáveis para o time.

**Desenvolvido por Marlon Giovany.**

> 🇺🇸 A collaborative Kanban task manager with day-by-day planning, built with React, Express and Prisma.

## Funcionalidades

- **Autenticação**: cadastro e login com e-mail e senha (bcrypt), sessões no servidor em cookie `HttpOnly`, logout que realmente encerra a sessão e "Sair de todos os dispositivos"
- **Login com Google** (opcional): botão oficial "Continuar com o Google"; o servidor valida o token com o Google e identifica a conta pelo `sub`. Se já existir uma conta com o mesmo e-mail, o vínculo exige a senha dela
- **Esqueci minha senha**: link por e-mail, de uso único e válido por 30 minutos
- **Minha conta**: criar ou trocar a senha (inclusive para contas criadas pelo Google)
- **Segurança**: proteção CSRF, limite de tentativas, mensagens que não revelam quais e-mails têm conta e política de senhas. Detalhes no [relatório de segurança](SECURITY.md)
- **Quadros**: criar, renomear e excluir; cada quadro novo já vem com *A fazer / Em andamento / Concluído*
- **Organização por data**: cada tarefa pertence a um dia, e o quadro mostra só as tarefas do dia selecionado (por padrão, hoje)
  - Seletor com a semana, a quantidade de tarefas por dia, setas de dia anterior/próximo e calendário para pular para qualquer data
  - Botão **Hoje** para voltar rapidamente ao dia atual
  - O dia escolhido fica na URL (`?dia=2026-10-01`), então recarregar a página ou compartilhar o link mantém a data
- **Trazer pendentes para hoje**: tarefas de dias anteriores que ainda não chegaram à última coluna (ex.: "Concluído") podem ser trazidas para hoje com um clique, mantendo a coluna de cada uma; dá para desfazer logo em seguida
- **Arrastar e soltar**: reordene cards e mova entre colunas (mouse e teclado)
- **Cards**: título, descrição, data e responsável; mudar a data move o card para outro dia
- **Exclusão segura**: cards, colunas e quadros só são excluídos depois de uma confirmação
- **Colaboração**: o dono convida membros por e-mail; membros podem sair e o dono pode removê-los
- **Controle de acesso**: toda rota verifica se o usuário é membro do quadro; quem não é recebe `404`, então não dá para descobrir ids de quadros alheios

## Tecnologias

| Camada | Ferramentas |
|---|---|
| Front-end | React 19, TypeScript, Vite, Tailwind CSS 4, React Router, dnd-kit |
| Back-end | Node.js, Express 5, TypeScript, Zod (validação), bcrypt, helmet, express-rate-limit, Nodemailer, google-auth-library |
| Banco de dados | PostgreSQL com Prisma 7 ORM |

## Como rodar

Requisito: Node.js 24. Não é preciso instalar o PostgreSQL: o Prisma sobe um PostgreSQL local com um comando.

```bash
# 1. API
cd server
npm install
npm run db:local            # sobe o PostgreSQL local e mostra a URL "TCP" de conexão
cp .env.example .env        # confira DATABASE_URL (as variáveis estão explicadas no arquivo)
npm run db:deploy           # cria as tabelas
npm run db:generate
npm run db:seed             # opcional: conta demo e quadro de exemplo
npm run dev                 # http://localhost:3333

# 2. App web (em outro terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

## Publicar na Vercel

O projeto já vem configurado para a Vercel (`vercel.json`). A CDN da Vercel entrega o front-end, e a API Express roda como uma Vercel Function (`api/index.mjs`). Os dois ficam no **mesmo domínio**, então o cookie de sessão e a proteção CSRF funcionam sem configuração extra. Tudo cabe nos planos gratuitos da Vercel (Hobby), do Neon e do Brevo.

1. **GitHub**: envie o repositório.
2. **Vercel**: *Add New → Project*, importe o repositório e deixe as configurações como estão (o `vercel.json` define instalação, build e rotas).
3. **Banco**: na aba *Storage* do projeto, crie um **Neon Postgres** (plano gratuito). A integração cria `DATABASE_URL` e `DATABASE_URL_UNPOOLED` sozinha. Escolha a mesma região das funções (padrão: `Washington, D.C., USA (East) – iad1`).
4. **Variáveis** (*Settings → Environment Variables*): `GOOGLE_CLIENT_ID`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `MAIL_FROM`. `NODE_ENV`, `CLIENT_URL` e `TRUST_PROXY` não precisam ser definidos na Vercel.
5. **Deploy**: o build compila front e API e aplica as migrações no banco (`prisma migrate deploy`). Cada `git push` na branch principal publica de novo.
6. **Google Cloud**: em *Origens JavaScript autorizadas*, acrescente o endereço do site (ex.: `https://atarefado.vercel.app`).

### Em um servidor comum (Render, Railway, VPS)

Na raiz do projeto, a API também entrega o front-end já compilado: **um único serviço, um único domínio**.

```bash
npm run build    # instala e compila o front (client/dist) e a API (server/dist)
npm start        # aplica as migrações pendentes e sobe o servidor
```

Variáveis obrigatórias: `NODE_ENV=production`, `DATABASE_URL` (PostgreSQL), `CLIENT_URL` (o endereço público, com `https://`) e `SMTP_*`. Atrás do proxy da hospedagem, use também `TRUST_PROXY=1`. Os detalhes estão no [relatório de segurança](SECURITY.md#configuração-para-produção).

**Conta demo** (depois do seed): `demo@atarefado.dev` / `demo12345`

### E-mails (recuperação de senha)

Em desenvolvimento não é preciso configurar nada: os e-mails são salvos em `server/.mail-outbox/` (abra o `.html` no navegador para clicar no link). Em produção, configure as variáveis `SMTP_*` e `MAIL_FROM` (na Vercel, em *Environment Variables*); sem elas o servidor não inicia em modo produção.

Uma opção gratuita é o **Brevo** (300 e-mails por dia, sem precisar de domínio próprio): crie a conta, valide o remetente em *Senders*, gere uma chave em *SMTP & API → SMTP* e use `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_USER` (o login SMTP mostrado na página), `SMTP_PASS` (a chave) e `MAIL_FROM="Atarefado <seu-remetente-validado>"`.

### Login com Google (opcional)

Sem configuração o app funciona normalmente, só sem o botão do Google. Para ativar:

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) e crie um projeto.
2. Em **Google Auth Platform** (ou "APIs e serviços → Tela de consentimento OAuth"), configure o app: nome "Atarefado", e-mail de suporte e público **Externo**. Enquanto o app estiver em modo **Teste**, adicione seu e-mail em **Usuários de teste**.
3. Em **Clientes** (ou "Credenciais → Criar credenciais → ID do cliente OAuth"), crie um cliente do tipo **Aplicativo da Web**.
4. Em **Origens JavaScript autorizadas**, adicione `http://localhost:5173` e `http://localhost` (e, ao publicar, o endereço do site, ex.: `https://atarefado.vercel.app`). Não é preciso URI de redirecionamento: o botão usa o pop-up do Google e devolve o *ID token* direto para a página.
5. Copie o **ID do cliente** (termina em `.apps.googleusercontent.com`) para `GOOGLE_CLIENT_ID` no `server/.env` e reinicie a API.

O ID do cliente não é secreto (ele aparece na página); nenhuma "chave secreta do cliente" é usada.

Como funciona: o botão do Google devolve um *ID token* assinado; a API confere assinatura, validade, emissor e se o token foi emitido para o nosso ID do cliente, e identifica a pessoa pelo `sub` do Google. Se não existir conta com aquele e-mail, uma conta nova é criada sem senha. Se já existir uma conta com senha usando o mesmo e-mail, o app pede a senha dessa conta antes de vincular o Google a ela.

## Como funcionam as datas

Cada card tem uma `date`: o dia a que a tarefa pertence. Ela trafega na API como `AAAA-MM-DD` e é gravada como meia-noite UTC, então representa o mesmo dia do calendário em qualquer fuso horário. O "hoje" vem do relógio do próprio usuário, e cards novos são criados no dia que estiver selecionado na tela.

Uma tarefa é **pendente** quando é de um dia anterior e não está na última coluna do quadro, que por convenção do Kanban guarda o que foi concluído. Num quadro com uma só coluna, todas as tarefas de dias anteriores contam como pendentes.

## Como funciona a ordenação dos cards

Cada card guarda uma `position` fracionária. Quando um card é solto entre outros dois, o front envia um valor no meio dos vizinhos (`(anterior + próximo) / 2`). Assim só o card movido é gravado no banco, sem precisar renumerar o resto da lista.

## Visão geral da API

A sessão vai no cookie `atarefado_session` (`HttpOnly`), definido no login. Todas as rotas, exceto as de autenticação, exigem uma sessão válida, e toda requisição que altera dados precisa vir da origem do front-end (proteção CSRF).

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` | Criar conta (já inicia a sessão) |
| POST | `/api/auth/login` | Entrar |
| POST | `/api/auth/logout` | Encerrar a sessão atual |
| POST | `/api/auth/logout-all` | Encerrar todas as sessões |
| GET | `/api/auth/me` | Usuário logado e formas de entrar (`hasPassword`, `hasGoogle`) |
| GET | `/api/auth/config` | Diz se o login com Google está ativo (e o ID do cliente) |
| POST | `/api/auth/google` | Entrar com o *ID token* do Google (409 `google_link_required` se o e-mail já tiver conta com senha) |
| POST | `/api/auth/google/link` | Confirmar a senha da conta existente e vincular o Google |
| POST | `/api/auth/forgot-password` | Pedir o e-mail de redefinição (resposta sempre genérica) |
| POST | `/api/auth/reset-password` | Definir nova senha com o token do e-mail |
| PUT | `/api/account/password` | Criar ou trocar a senha |
| GET / POST | `/api/boards` | Listar / criar quadros |
| GET | `/api/boards/:id?date=AAAA-MM-DD` | Quadro com colunas, membros e os cards do dia |
| PATCH / DELETE | `/api/boards/:id` | Renomear / excluir quadro (excluir: dono) |
| GET | `/api/boards/:id/days?from=…&to=…` | Quantidade de cards por dia no intervalo |
| GET | `/api/boards/:id/pending?before=AAAA-MM-DD` | Quantidade de tarefas pendentes antes do dia |
| POST | `/api/boards/:id/pending/move` | Traz as pendentes para o dia `to`; devolve as datas originais |
| POST | `/api/boards/:id/cards/reschedule` | Muda a data de vários cards de uma vez (usado no "Desfazer") |
| POST | `/api/boards/:id/members` | Convidar por e-mail (dono) |
| DELETE | `/api/boards/:id/members/:userId` | Remover membro ou sair |
| POST | `/api/boards/:id/columns` | Criar coluna |
| PATCH / DELETE | `/api/columns/:id` | Renomear / excluir coluna |
| POST | `/api/columns/:id/cards` | Criar card (com `date`) |
| PATCH / DELETE | `/api/cards/:id` | Editar / excluir card |
| POST | `/api/cards/:id/move` | Mover card (coluna + posição) |

## Estrutura do projeto

```
client/   App React (pages, components/board, lib/api, lib/dates)
server/   API Express (routes, middleware, lib) + schema, migrations e seed do Prisma
          tests/  testes de ponta a ponta da API, de segurança, do login com Google e de serverless
api/      Ponto de entrada da Vercel Function (carrega a API compilada)
vercel.json  Build, rotas e cabeçalhos de segurança na Vercel
```

## Testes

Com a API rodando (`npm run dev` em `server/`), em outro terminal na pasta `server/`:

```bash
npm test    # 163 verificações: rotas, controle de acesso, sessões, CSRF, senhas, recuperação de senha, Google e limites entre instâncias
```

Os detalhes estão no [relatório de segurança](SECURITY.md).

## Próximos passos

- [ ] Sincronização em tempo real entre usuários (na Vercel, que não mantém conexões WebSocket abertas, via um serviço externo como Pusher ou Ably)
- [ ] Comentários e histórico de atividades nos cards
- [ ] Verificação de e-mail no cadastro e autenticação em dois fatores
- [ ] CI com GitHub Actions rodando os testes
- [ ] Publicar online (Vercel)
- [ ] Modo escuro

## Autor

**Marlon Giovany**

## Licença

[MIT](LICENSE) © 2026 Marlon Giovany
