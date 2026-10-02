import { prisma } from "./prisma.js";

// Board addresses: /quadros/<slug>. The slug is the title in lowercase ASCII with
// dashes ("Tarefas Diárias" -> "tarefas-diarias"); a taken slug gets "-2", "-3"...
// Same rules as the migration that filled in existing boards.

const MAX_LENGTH = 60;

export function slugify(title: string) {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LENGTH)
    .replace(/-+$/, "");
  return slug || "quadro";
}

/** Whether `slug` already belongs to `title` ("tarefas-diarias" or "tarefas-diarias-3"). */
export function slugMatchesTitle(slug: string, title: string) {
  const base = slugify(title);
  return slug === base || (slug.startsWith(`${base}-`) && /^\d+$/.test(slug.slice(base.length + 1)));
}

/** First free slug for `title`, ignoring the board being renamed. */
export async function freeBoardSlug(title: string, exceptBoardId?: string) {
  const base = slugify(title);
  const rows = await prisma.board.findMany({
    where: { slug: { startsWith: base }, ...(exceptBoardId && { id: { not: exceptBoardId } }) },
    select: { slug: true },
  });
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }
}

const isUniqueViolation = (err: unknown) =>
  typeof err === "object" && err !== null && "code" in err && err.code === "P2002";

// Each lost race costs one attempt, so this is how many boards with the very same
// name can be created at the same instant
const MAX_ATTEMPTS = 10;

/**
 * Runs `write` with a free slug for `title`. If another request takes the same
 * slug in the meantime, the unique index rejects it and a new one is picked.
 */
export async function withBoardSlug<T>(
  title: string,
  write: (slug: string) => Promise<T>,
  exceptBoardId?: string,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const slug = await freeBoardSlug(title, exceptBoardId);
    try {
      return await write(slug);
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS || !isUniqueViolation(err)) throw err;
    }
  }
}
