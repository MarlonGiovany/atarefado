# Atarefado

Gerenciador de tarefas colaborativo no estilo Kanban: crie quadros, organize as tarefas por dia, arraste cards entre colunas e atribua responsáveis para o time.

**Desenvolvido por Marlon Giovany.**

> 🇺🇸 A collaborative Kanban task manager with day-by-day planning, built with React, Express and Prisma.

## Funcionalidades

- **Autenticação**: cadastro e login com JWT; senhas criptografadas com bcrypt
- **Quadros**: criar, renomear e excluir; cada quadro novo já vem com *A fazer / Em andamento / Concluído*
- **Organização por data**: cada tarefa pertence a um dia, e o quadro mostra só as tarefas do dia selecionado (por padrão, hoje)
  - Seletor com a semana, a quantidade de tarefas por dia, setas de dia anterior/próximo e calendário para pular para qualquer data
  - Botão **Hoje** para voltar rapidamente ao dia atual
  - O dia escolhido fica na URL (`?dia=2026-10-01`), então recarregar a página ou compartilhar o link mantém a data
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

## Como funcionam as datas

Cada card tem uma `date`: o dia a que a tarefa pertence. Ela trafega na API como `AAAA-MM-DD` e é gravada como meia-noite UTC, então representa o mesmo dia do calendário em qualquer fuso horário. O "hoje" vem do relógio do próprio usuário, e cards novos são criados no dia que estiver selecionado na tela.

## Como funciona a ordenação dos cards

Cada card guarda uma `position` fracionária. Quando um card é solto entre outros dois, o front envia um valor no meio dos vizinhos (`(anterior + próximo) / 2`). Assim só o card movido é gravado no banco, sem precisar renumerar o resto da lista.

## Visão geral da API

Todas as rotas, exceto as de autenticação, exigem `Authorization: Bearer <token>`.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` | Criar conta |
| POST | `/api/auth/login` | Entrar |
| GET | `/api/auth/me` | Usuário logado |
| GET / POST | `/api/boards` | Listar / criar quadros |
| GET | `/api/boards/:id?date=AAAA-MM-DD` | Quadro com colunas, membros e os cards do dia |
| PATCH / DELETE | `/api/boards/:id` | Renomear / excluir quadro (excluir: dono) |
| GET | `/api/boards/:id/days?from=…&to=…` | Quantidade de cards por dia no intervalo |
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
