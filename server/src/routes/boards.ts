import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { requireMember, requireOwner } from "../lib/access.js";
import { dateToDay, dayString, dayToDate } from "../lib/dates.js";
import { currentUser } from "../middleware/auth.js";

export const boardsRouter = Router();

const DEFAULT_COLUMNS = ["A fazer", "Em andamento", "Concluído"];

const titleSchema = z.object({ title: z.string().trim().min(1).max(100) });

boardsRouter.get("/", async (req, res) => {
  const boards = await prisma.board.findMany({
    where: { members: { some: { userId: currentUser(req) } } },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { members: true } } },
  });
  res.json({ boards });
});

boardsRouter.post("/", async (req, res) => {
  const { title } = titleSchema.parse(req.body);
  const board = await prisma.board.create({
    data: {
      title,
      members: { create: { userId: currentUser(req), role: "OWNER" } },
      columns: {
        create: DEFAULT_COLUMNS.map((title, i) => ({ title, position: i + 1 })),
      },
    },
  });
  res.status(201).json({ board });
});

/** `?date=YYYY-MM-DD` limits the cards to that day; without it every card is returned. */
boardsRouter.get("/:boardId", async (req, res) => {
  const { boardId } = req.params;
  await requireMember(boardId, currentUser(req));
  const { date } = z.object({ date: dayString.optional() }).parse(req.query);

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      columns: {
        orderBy: { position: "asc" },
        include: {
          cards: {
            where: date ? { date: dayToDate(date) } : undefined,
            orderBy: { position: "asc" },
            include: { assignee: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });
  res.json({ board });
});

/** Number of cards per day in a date range, used by the day picker. */
boardsRouter.get("/:boardId/days", async (req, res) => {
  const { boardId } = req.params;
  await requireMember(boardId, currentUser(req));
  const { from, to } = z.object({ from: dayString, to: dayString }).parse(req.query);
  if (from > to) throw new HttpError(400, "Intervalo de datas inválido");

  const groups = await prisma.card.groupBy({
    by: ["date"],
    where: { column: { boardId }, date: { gte: dayToDate(from), lte: dayToDate(to) } },
    _count: { _all: true },
  });
  const days = Object.fromEntries(groups.map((g) => [dateToDay(g.date), g._count._all]));
  res.json({ days });
});

// --- Pending tasks (carry-over) ---

/**
 * Cards from days before `before` that aren't finished. By Kanban convention the
 * board's last column holds finished work; a board with a single column has no
 * "done" column, so every earlier card counts as pending.
 */
async function pendingCardsWhere(
  db: Pick<typeof prisma, "column">,
  boardId: string,
  before: string,
): Promise<Prisma.CardWhereInput> {
  const columns = await db.column.findMany({
    where: { boardId },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  const doneColumn = columns.length > 1 ? columns[columns.length - 1] : undefined;
  return {
    column: { boardId },
    date: { lt: dayToDate(before) },
    ...(doneColumn && { columnId: { not: doneColumn.id } }),
  };
}

boardsRouter.get("/:boardId/pending", async (req, res) => {
  const { boardId } = req.params;
  await requireMember(boardId, currentUser(req));
  const { before } = z.object({ before: dayString }).parse(req.query);
  const count = await prisma.card.count({ where: await pendingCardsWhere(prisma, boardId, before) });
  res.json({ count });
});

/** Moves every pending card to `to`, returning their previous days so the client can undo. */
boardsRouter.post("/:boardId/pending/move", async (req, res) => {
  const { boardId } = req.params;
  await requireMember(boardId, currentUser(req));
  const { to } = z.object({ to: dayString }).parse(req.body);

  const moved = await prisma.$transaction(async (tx) => {
    const cards = await tx.card.findMany({
      where: await pendingCardsWhere(tx, boardId, to),
      select: { id: true, date: true },
    });
    await tx.card.updateMany({
      where: { id: { in: cards.map((c) => c.id) } },
      data: { date: dayToDate(to) },
    });
    return cards.map((c) => ({ id: c.id, date: dateToDay(c.date) }));
  });
  res.json({ moved });
});

/** Sets the day of several cards at once (used to undo a carry-over). */
boardsRouter.post("/:boardId/cards/reschedule", async (req, res) => {
  const { boardId } = req.params;
  await requireMember(boardId, currentUser(req));
  const { cards } = z
    .object({
      cards: z.array(z.object({ id: z.string(), date: dayString })).min(1).max(500),
    })
    .parse(req.body);

  const ids = [...new Set(cards.map((c) => c.id))];
  const found = await prisma.card.count({ where: { id: { in: ids }, column: { boardId } } });
  if (found !== ids.length) throw new HttpError(404, "Card não encontrado");

  await prisma.$transaction(
    cards.map((c) =>
      prisma.card.update({ where: { id: c.id }, data: { date: dayToDate(c.date) } }),
    ),
  );
  res.json({ updated: cards.length });
});

boardsRouter.patch("/:boardId", async (req, res) => {
  const { boardId } = req.params;
  await requireMember(boardId, currentUser(req));
  const { title } = titleSchema.parse(req.body);
  const board = await prisma.board.update({ where: { id: boardId }, data: { title } });
  res.json({ board });
});

boardsRouter.delete("/:boardId", async (req, res) => {
  const { boardId } = req.params;
  await requireOwner(boardId, currentUser(req));
  await prisma.board.delete({ where: { id: boardId } });
  res.status(204).end();
});

// --- Members ---

boardsRouter.post("/:boardId/members", async (req, res) => {
  const { boardId } = req.params;
  await requireOwner(boardId, currentUser(req));
  const { email } = z.object({ email: z.email().toLowerCase() }).parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new HttpError(404, "Nenhum usuário cadastrado com este e-mail");

  const existing = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId: user.id } },
  });
  if (existing) throw new HttpError(409, "Este usuário já é membro do quadro");

  const member = await prisma.boardMember.create({
    data: { boardId, userId: user.id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  res.status(201).json({ member });
});

boardsRouter.delete("/:boardId/members/:userId", async (req, res) => {
  const { boardId, userId } = req.params;
  const me = currentUser(req);
  // Members may leave on their own; only the owner may remove others.
  if (userId === me) {
    const membership = await requireMember(boardId, me);
    if (membership.role === "OWNER") {
      throw new HttpError(400, "O dono não pode sair do quadro; exclua o quadro em vez disso");
    }
  } else {
    await requireOwner(boardId, me);
  }

  await prisma.$transaction([
    // Unassign the removed user's cards on this board
    prisma.card.updateMany({
      where: { assigneeId: userId, column: { boardId } },
      data: { assigneeId: null },
    }),
    prisma.boardMember.delete({ where: { boardId_userId: { boardId, userId } } }),
  ]);
  res.status(204).end();
});

// --- Columns (created under a board) ---

boardsRouter.post("/:boardId/columns", async (req, res) => {
  const { boardId } = req.params;
  await requireMember(boardId, currentUser(req));
  const { title } = titleSchema.parse(req.body);

  const last = await prisma.column.findFirst({
    where: { boardId },
    orderBy: { position: "desc" },
  });
  const column = await prisma.column.create({
    data: { title, boardId, position: (last?.position ?? 0) + 1 },
    include: { cards: true },
  });
  res.status(201).json({ column });
});
