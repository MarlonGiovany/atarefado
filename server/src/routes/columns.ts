import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { boardIdOfColumn, requireMember } from "../lib/access.js";
import { currentUser } from "../middleware/auth.js";

export const columnsRouter = Router();

const updateSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  position: z.number().finite().optional(),
});

columnsRouter.patch("/:columnId", async (req, res) => {
  const { columnId } = req.params;
  await requireMember(await boardIdOfColumn(columnId), currentUser(req));
  const data = updateSchema.parse(req.body);
  const column = await prisma.column.update({ where: { id: columnId }, data });
  res.json({ column });
});

columnsRouter.delete("/:columnId", async (req, res) => {
  const { columnId } = req.params;
  await requireMember(await boardIdOfColumn(columnId), currentUser(req));
  await prisma.column.delete({ where: { id: columnId } });
  res.status(204).end();
});

// --- Cards (created under a column) ---

columnsRouter.post("/:columnId/cards", async (req, res) => {
  const { columnId } = req.params;
  await requireMember(await boardIdOfColumn(columnId), currentUser(req));
  const { title, description } = z
    .object({
      title: z.string().trim().min(1).max(200),
      description: z.string().max(5000).optional(),
    })
    .parse(req.body);

  const last = await prisma.card.findFirst({
    where: { columnId },
    orderBy: { position: "desc" },
  });
  const card = await prisma.card.create({
    data: { title, description, columnId, position: (last?.position ?? 0) + 1 },
    include: { assignee: { select: { id: true, name: true } } },
  });
  res.status(201).json({ card });
});
