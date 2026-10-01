-- Replace the optional "dueDate" with a required "date": the day each task belongs to.
-- Existing cards keep their due date, or fall back to the day they were created.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Card" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "position" REAL NOT NULL,
    "date" DATETIME NOT NULL,
    "columnId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Card_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "Column" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Card_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Card" ("assigneeId", "columnId", "createdAt", "date", "description", "id", "position", "title")
SELECT
    "assigneeId",
    "columnId",
    "createdAt",
    COALESCE("dueDate", substr("createdAt", 1, 10) || 'T00:00:00.000+00:00'),
    "description",
    "id",
    "position",
    "title"
FROM "Card";
DROP TABLE "Card";
ALTER TABLE "new_Card" RENAME TO "Card";
CREATE INDEX "Card_columnId_idx" ON "Card"("columnId");
CREATE INDEX "Card_date_idx" ON "Card"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
