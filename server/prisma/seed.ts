/**
 * Seeds a demo account with a sample board so visitors can try the app.
 * Safe to re-run: the demo users and their boards are recreated from scratch.
 *
 *   Demo login: demo@atarefado.dev / demo12345
 */
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.js";

const DEMO_PASSWORD = "demo12345";

const users = [
  { name: "Usuário Demo", email: "demo@atarefado.dev" },
  { name: "Ana Souza", email: "ana@atarefado.dev" },
  { name: "Pedro Lima", email: "pedro@atarefado.dev" },
];

/** Day relative to the local "today" of whoever runs the seed, stored as UTC midnight. */
const daysFromToday = (days: number) => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + days));
};

type SeedCard = { title: string; description?: string; day: number; assignee?: number };

const columns: { title: string; cards: SeedCard[] }[] = [
  {
    title: "A fazer",
    cards: [
      { title: "Escrever README com prints", day: 0, assignee: 0 },
      {
        title: "Adicionar modo escuro",
        description: "Respeitar o tema do sistema e ter um botão para alternar.",
        day: 0,
      },
      { title: "Configurar CI com GitHub Actions", day: 1, assignee: 1 },
      { title: "Publicar o app online", day: 3, assignee: 0 },
      { title: "Revisar textos da interface", day: -1, assignee: 2 },
    ],
  },
  {
    title: "Em andamento",
    cards: [
      {
        title: "Atualizações em tempo real com Socket.IO",
        description: "Enviar a movimentação dos cards para todos que estão vendo o quadro.",
        day: 0,
        assignee: 0,
      },
      { title: "Comentários nos cards", day: 1, assignee: 2 },
    ],
  },
  {
    title: "Em revisão",
    cards: [
      { title: "Arrastar e soltar entre colunas", day: 0, assignee: 1 },
      { title: "Seletor de datas", day: -1, assignee: 0 },
    ],
  },
  {
    title: "Concluído",
    cards: [
      { title: "Autenticação com JWT", day: -2, assignee: 0 },
      { title: "Compartilhamento de quadros e permissões", day: -1, assignee: 2 },
      { title: "Traduzir a interface", day: 0, assignee: 1 },
    ],
  },
];

async function main() {
  const emails = users.map((u) => u.email);
  // Remove boards owned by demo users, then the users themselves
  await prisma.board.deleteMany({
    where: { members: { some: { role: "OWNER", user: { email: { in: emails } } } } },
  });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const created = await Promise.all(
    users.map((u) => prisma.user.create({ data: { ...u, passwordHash } })),
  );
  const [owner, ...team] = created;

  await prisma.board.create({
    data: {
      title: "Lançamento do produto",
      members: {
        create: [
          { userId: owner.id, role: "OWNER" },
          ...team.map((u) => ({ userId: u.id })),
        ],
      },
      columns: {
        create: columns.map((col, i) => ({
          title: col.title,
          position: i + 1,
          cards: {
            create: col.cards.map((card, j) => ({
              title: card.title,
              description: card.description ?? "",
              position: j + 1,
              date: daysFromToday(card.day),
              assigneeId: card.assignee !== undefined ? created[card.assignee].id : null,
            })),
          },
        })),
      },
    },
  });

  await prisma.board.create({
    data: {
      title: "Pessoal",
      members: { create: { userId: owner.id, role: "OWNER" } },
      columns: {
        create: ["A fazer", "Fazendo", "Feito"].map((title, i) => ({ title, position: i + 1 })),
      },
    },
  });

  console.log(`Seeded demo data. Log in with ${owner.email} / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
