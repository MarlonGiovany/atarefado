import { prisma } from "./prisma.js";
import { HttpError } from "./http-error.js";

/**
 * Ensures the user belongs to the board and returns their membership.
 * Responds 404 (not 403) so non-members can't probe which boards exist.
 */
export async function requireMember(boardId: string, userId: string) {
  const membership = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
  });
  if (!membership) throw new HttpError(404, "Board not found");
  return membership;
}

export async function requireOwner(boardId: string, userId: string) {
  const membership = await requireMember(boardId, userId);
  if (membership.role !== "OWNER") {
    throw new HttpError(403, "Only the board owner can do this");
  }
  return membership;
}

export async function boardIdOfColumn(columnId: string) {
  const column = await prisma.column.findUnique({
    where: { id: columnId },
    select: { boardId: true },
  });
  if (!column) throw new HttpError(404, "Column not found");
  return column.boardId;
}

export async function boardIdOfCard(cardId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { column: { select: { boardId: true } } },
  });
  if (!card) throw new HttpError(404, "Card not found");
  return card.column.boardId;
}
