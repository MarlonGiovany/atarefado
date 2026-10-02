-- Readable board addresses (/quadros/<slug>). Existing boards get a slug made
-- from their title, oldest first, with "-2", "-3"... when the name is taken;
-- the same rules as src/lib/slugs.ts.

-- AddColumn (nullable until every board has a value)
ALTER TABLE "Board" ADD COLUMN "slug" TEXT;

-- Backfill
DO $$
DECLARE
  b RECORD;
  base TEXT;
  candidate TEXT;
  n INT;
BEGIN
  FOR b IN SELECT "id", "title" FROM "Board" ORDER BY "createdAt", "id" LOOP
    base := lower(translate(b."title",
      'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñÝýÿ',
      'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYyy'));
    base := trim(both '-' from regexp_replace(base, '[^a-z0-9]+', '-', 'g'));
    base := trim(trailing '-' from left(base, 60));
    IF base = '' THEN
      base := 'quadro';
    END IF;

    candidate := base;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM "Board" WHERE "slug" = candidate) LOOP
      n := n + 1;
      candidate := base || '-' || n;
    END LOOP;

    UPDATE "Board" SET "slug" = candidate WHERE "id" = b."id";
  END LOOP;
END $$;

-- AlterColumn
ALTER TABLE "Board" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Board_slug_key" ON "Board"("slug");
