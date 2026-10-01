/**
 * Seeds a demo account with a sample board so visitors can try the app.
 * Safe to re-run: the demo users and their boards are recreated from scratch.
 *
 *   Demo login: demo@taskflow.dev / demo12345
 */
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.js";

const DEMO_PASSWORD = "demo12345";

const users = [
  { name: "Demo User", email: "demo@taskflow.dev" },
  { name: "Alex Rivera", email: "alex@taskflow.dev" },
  { name: "Sam Lee", email: "sam@taskflow.dev" },
];

const daysFromNow = (days: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

type SeedCard = { title: string; description?: string; due?: number; assignee?: number };

const columns: { title: string; cards: SeedCard[] }[] = [
  {
    title: "To do",
    cards: [
      { title: "Write README with screenshots", due: 5, assignee: 0 },
      { title: "Add dark mode", description: "Respect prefers-color-scheme and add a toggle." },
      { title: "Set up CI with GitHub Actions", due: 10, assignee: 1 },
    ],
  },
  {
    title: "In progress",
    cards: [
      {
        title: "Real-time updates with Socket.IO",
        description: "Broadcast card moves to everyone viewing the board.",
        due: 2,
        assignee: 0,
      },
      { title: "Card comments", assignee: 2 },
    ],
  },
  {
    title: "Review",
    cards: [{ title: "Drag and drop between columns", due: -1, assignee: 1 }],
  },
  {
    title: "Done",
    cards: [
      { title: "JWT authentication", assignee: 0 },
      { title: "Board sharing and roles", assignee: 2 },
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
      title: "Product launch",
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
              dueDate: card.due !== undefined ? daysFromNow(card.due) : null,
              assigneeId: card.assignee !== undefined ? created[card.assignee].id : null,
            })),
          },
        })),
      },
    },
  });

  await prisma.board.create({
    data: {
      title: "Personal",
      members: { create: { userId: owner.id, role: "OWNER" } },
      columns: {
        create: ["To do", "Doing", "Done"].map((title, i) => ({ title, position: i + 1 })),
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
