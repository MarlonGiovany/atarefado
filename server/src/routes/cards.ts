import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { boardIdOfCard, boardIdOfColumn, requireMember } from "../lib/access.js";
import { currentUser } from "../middleware/auth.js";

export const cardsRouter = Router();

const cardInclude = { assignee: { select: { id: true, name: true } } } as const;

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
});

cardsRouter.patch("/:cardId", async (req, res) => {
  const { cardId } = req.params;
  const boardId = await boardIdOfCard(cardId);
  await requireMember(boardId, currentUser(req));
  const data = updateSchema.parse(req.body);

  if (data.assigneeId) {
    const isMember = await prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: data.assigneeId } },
    });
    if (!isMember) throw new HttpError(400, "Assignee must be a board member");
  }

  const card = await prisma.card.update({
    where: { id: cardId },
    data,
    include: cardInclude,
  });
  res.json({ card });
});

/**
 * Moves a card to a column at a given position.
 * The client computes `position` as a value between the neighbouring cards
 * (fractional indexing), so only the moved card needs to be written.
 */
cardsRouter.post("/:cardId/move", async (req, res) => {
  const { cardId } = req.params;
  const userId = currentUser(req);
  const { columnId, position } = z
    .object({ columnId: z.string(), position: z.number().finite() })
    .parse(req.body);

  const fromBoard = await boardIdOfCard(cardId);
  await requireMember(fromBoard, userId);
  if ((await boardIdOfColumn(columnId)) !== fromBoard) {
    throw new HttpError(400, "Cards can only move within the same board");
  }

  const card = await prisma.card.update({
    where: { id: cardId },
    data: { columnId, position },
    include: cardInclude,
  });
  res.json({ card });
});

cardsRouter.delete("/:cardId", async (req, res) => {
  const { cardId } = req.params;
  await requireMember(await boardIdOfCard(cardId), currentUser(req));
  await prisma.card.delete({ where: { id: cardId } });
  res.status(204).end();
});
