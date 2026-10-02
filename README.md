# Atarefado

Gerenciador de tarefas colaborativo no estilo Kanban: crie quadros, organize as tarefas por dia, arraste cards entre colunas e atribua responsáveis para o time.

**Desenvolvido por Marlon Giovany.**

> 🇺🇸 A collaborative Kanban task manager with day-by-day planning, built with React, Express and Prisma.

## Funcionalidades

- **Autenticação**: cadastro e login com JWT; senhas criptografadas com bcrypt
- **Login com Google** (opcional): botão oficial "Continuar com o Google"; o servidor confere a assinatura do token com o Google e vincula a conta pelo e-mail verificado
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
| Back-end | Node.js, Express 5, TypeScript, Zod (validação), JWT |
| Banco de dados | Prisma 7 ORM, SQLite (desenvolvimento); pode ser trocado por PostgreSQL |

## Como rodar

Requisito: Node.js 20 ou superior.

```bash
# 1. API
cd server
npm install
cp .env.example .env        # depois defina JWT_SECRET com uma string longa e aleatória
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

### Login com Google (opcional)

Sem configuração o app funciona normalmente, só sem o botão do Google. Para ativar:

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) e crie um projeto.
2. Em **Google Auth Platform** (ou "APIs e serviços → Tela de consentimento OAuth"), configure o app: nome "Atarefado", e-mail de suporte e público **Externo**. Enquanto o app estiver em modo **Teste**, adicione seu e-mail em **Usuários de teste**.
3. Em **Clientes** (ou "Credenciais → Criar credenciais → ID do cliente OAuth"), crie um cliente do tipo **Aplicativo da Web**.
4. Em **Origens JavaScript autorizadas**, adicione `http://localhost:5173` e `http://localhost`. Não é preciso URI de redirecionamento.
5. Copie o **ID do cliente** (termina em `.apps.googleusercontent.com`) para `GOOGLE_CLIENT_ID` no `server/.env` e reinicie a API.

O ID do cliente não é secreto (ele aparece na página); nenhuma "chave secreta do cliente" é usada.

Como funciona: o botão do Google devolve um *ID token* assinado; a API confere assinatura, validade, emissor e se o token foi emitido para o nosso ID do cliente. Se já existir uma conta com o mesmo e-mail, o Google é vinculado a ela; se não, uma conta nova é criada sem senha.

## Como funcionam as datas

Cada card tem uma `date`: o dia a que a tarefa pertence. Ela trafega na API como `AAAA-MM-DD` e é gravada como meia-noite UTC, então representa o mesmo dia do calendário em qualquer fuso horário. O "hoje" vem do relógio do próprio usuário, e cards novos são criados no dia que estiver selecionado na tela.

Uma tarefa é **pendente** quando é de um dia anterior e não está na última coluna do quadro, que por convenção do Kanban guarda o que foi concluído. Num quadro com uma só coluna, todas as tarefas de dias anteriores contam como pendentes.

## Como funciona a ordenação dos cards

Cada card guarda uma `position` fracionária. Quando um card é solto entre outros dois, o front envia um valor no meio dos vizinhos (`(anterior + próximo) / 2`). Assim só o card movido é gravado no banco, sem precisar renumerar o resto da lista.

## Visão geral da API

Todas as rotas, exceto as de autenticação, exigem `Authorization: Bearer <token>`.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` | Criar conta |
| POST | `/api/auth/login` | Entrar |
| GET | `/api/auth/me` | Usuário logado |
| GET | `/api/auth/config` | Diz se o login com Google está ativo (e o ID do cliente) |
| POST | `/api/auth/google` | Entrar com o *ID token* do Google |
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
```

## Próximos passos

- [ ] Sincronização em tempo real entre usuários (Socket.IO)
- [ ] Comentários e histórico de atividades nos cards
- [ ] Testes automatizados (Vitest + Supertest) e CI com GitHub Actions
- [ ] Deploy (Vercel + Render) com PostgreSQL
- [ ] Modo escuro

## Autor

**Marlon Giovany**

## Licença

[MIT](LICENSE) © 2026 Marlon Giovany
