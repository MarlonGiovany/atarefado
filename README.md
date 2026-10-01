# TaskFlow

Gerenciador de tarefas colaborativo no estilo Kanban: crie quadros, arraste cards entre colunas, atribua tarefas para o time e acompanhe os prazos.

**Desenvolvido por Marlon Giovany.**

> 🇺🇸 A collaborative Kanban task manager built with React, Express and Prisma.

## Funcionalidades

- **Autenticação**: cadastro e login com JWT; senhas criptografadas com bcrypt
- **Quadros**: criar, renomear e excluir; cada quadro novo já vem com *A fazer / Em andamento / Concluído*
- **Arrastar e soltar**: reordene cards e mova entre colunas (mouse e teclado)
- **Cards**: título, descrição, prazo (com selos de *Atrasado* e *Hoje*) e responsável
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

**Conta demo** (depois do seed): `demo@taskflow.dev` / `demo12345`

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
| GET / PATCH / DELETE | `/api/boards/:id` | Quadro com colunas, cards e membros |
| POST | `/api/boards/:id/members` | Convidar por e-mail (dono) |
| DELETE | `/api/boards/:id/members/:userId` | Remover membro ou sair |
| POST | `/api/boards/:id/columns` | Criar coluna |
| PATCH / DELETE | `/api/columns/:id` | Renomear / excluir coluna |
| POST | `/api/columns/:id/cards` | Criar card |
| PATCH / DELETE | `/api/cards/:id` | Editar / excluir card |
| POST | `/api/cards/:id/move` | Mover card (coluna + posição) |

## Estrutura do projeto

```
client/   App React (pages, components/board, lib/api)
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
