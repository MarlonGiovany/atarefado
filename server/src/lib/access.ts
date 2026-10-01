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
  if (!membership) throw new HttpError(404, "Quadro não encontrado");
  return membership;
}

export async function requireOwner(boardId: string, userId: string) {
  const membership = await requireMember(boardId, userId);
  if (membership.role !== "OWNER") {
    throw new HttpError(403, "Apenas o dono do quadro pode fazer isso");
  }
  return membership;
}

export async function boardIdOfColumn(columnId: string) {
  const column = await prisma.column.findUnique({
    where: { id: columnId },
    select: { boardId: true },
  });
  if (!column) throw new HttpError(404, "Coluna não encontrada");
  return column.boardId;
}

export async function boardIdOfCard(cardId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { column: { select: { boardId: true } } },
  });
  if (!card) throw new HttpError(404, "Card não encontrado");
  return card.column.boardId;
}
