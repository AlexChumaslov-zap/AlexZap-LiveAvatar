-- CreateTable
CREATE TABLE "HealthEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state" TEXT NOT NULL,
    "detail" TEXT,
    "latencyMs" INTEGER
);

-- CreateIndex
CREATE INDEX "HealthEvent_at_idx" ON "HealthEvent"("at");
