-- CreateTable
CREATE TABLE "MarkerDirection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "markerId" TEXT NOT NULL,
    "angle" REAL NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "MarkerDirection_markerId_fkey" FOREIGN KEY ("markerId") REFERENCES "Marker" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Marker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "x2" REAL,
    "y2" REAL,
    "flipped" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Marker_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Marker" ("createdAt", "id", "label", "note", "pageId", "type", "x", "y") SELECT "createdAt", "id", "label", "note", "pageId", "type", "x", "y" FROM "Marker";
DROP TABLE "Marker";
ALTER TABLE "new_Marker" RENAME TO "Marker";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
