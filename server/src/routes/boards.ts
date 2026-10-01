import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { requireMember, requireOwner } from "../lib/access.js";
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

boardsRouter.get("/:boardId", async (req, res) => {
  const { boardId } = req.params;
  await requireMember(boardId, currentUser(req));

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
            orderBy: { position: "asc" },
            include: { assignee: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });
  res.json({ board });
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
