# TaskFlow

A collaborative Kanban board for teams: create boards, drag cards across columns, assign tasks to teammates and keep deadlines in sight.

> 🇧🇷 Gerenciador de tarefas colaborativo no estilo Kanban, feito com React, Express e Prisma.

## Features

- **Authentication**: sign up and log in with JWT, passwords hashed with bcrypt
- **Boards**: create, rename and delete boards; each board starts with *To do / In progress / Done*
- **Drag and drop**: reorder cards and move them between columns (mouse and keyboard)
- **Cards**: title, description, due date (with *overdue* / *today* badges) and assignee
- **Collaboration**: the owner invites members by email; members can leave, the owner can remove them
- **Access control**: every endpoint checks board membership; non-members get `404` so board ids can't be probed

## Tech stack

| Layer | Tools |
|---|---|
| Front end | React 19, TypeScript, Vite, Tailwind CSS 4, React Router, dnd-kit |
| Back end | Node.js, Express 5, TypeScript, Zod (validation), JWT |
| Database | Prisma 7 ORM, SQLite (dev); swappable for PostgreSQL |

## Getting started

Requirements: Node.js 20+.

```bash
# 1. API
cd server
npm install
cp .env.example .env        # then set JWT_SECRET to a long random string
npx prisma migrate dev      # creates the database
npx prisma generate
npm run db:seed             # optional: demo account and sample board
npm run dev                 # http://localhost:3333

# 2. Web app (in another terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

**Demo account** (after seeding): `demo@taskflow.dev` / `demo12345`

## How card ordering works

Cards store a fractional `position`. When a card is dropped between two others, the client sends a value halfway between its neighbours (`(before + after) / 2`), so only the moved card is written; the rest of the list never needs renumbering.

## API overview

All routes except auth require `Authorization: Bearer <token>`.

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Log in |
| GET | `/api/auth/me` | Current user |
| GET / POST | `/api/boards` | List / create boards |
| GET / PATCH / DELETE | `/api/boards/:id` | Board with columns, cards and members |
| POST | `/api/boards/:id/members` | Invite by email (owner) |
| DELETE | `/api/boards/:id/members/:userId` | Remove member or leave |
| POST | `/api/boards/:id/columns` | Add column |
| PATCH / DELETE | `/api/columns/:id` | Rename / delete column |
| POST | `/api/columns/:id/cards` | Add card |
| PATCH / DELETE | `/api/cards/:id` | Edit / delete card |
| POST | `/api/cards/:id/move` | Move card (column + position) |

## Project structure

```
client/   React app (pages, components/board, lib/api)
server/   Express API (routes, middleware, lib) + Prisma schema, migrations and seed
```

## Roadmap

- [ ] Real-time sync between users (Socket.IO)
- [ ] Card comments and activity history
- [ ] Automated tests (Vitest + Supertest) and GitHub Actions CI
- [ ] Deploy (Vercel + Render) with PostgreSQL
- [ ] Dark mode
