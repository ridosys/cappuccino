import "dotenv/config";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";

const migrationName = process.argv[2];
if (!migrationName) {
  console.error("Usage: node apply-init-migration.mjs <migration_name>");
  process.exit(1);
}

const sqlPath = `prisma/migrations/${migrationName}/migration.sql`;
const sql = readFileSync(sqlPath, "utf8");
const checksum = createHash("sha256").update(sql).digest("hex");

const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) NOT NULL,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
    );
  `);

  const { rows } = await client.query(
    `SELECT 1 FROM "_prisma_migrations" WHERE migration_name = $1`,
    [migrationName],
  );
  if (rows.length > 0) {
    console.log(`Migration ${migrationName} already recorded, skipping.`);
    process.exit(0);
  }

  await client.query(sql);

  await client.query(
    `INSERT INTO "_prisma_migrations"
       (id, checksum, finished_at, migration_name, applied_steps_count, started_at)
     VALUES ($1, $2, now(), $3, 1, now())`,
    [randomUUID(), checksum, migrationName],
  );

  console.log(`Applied and recorded migration: ${migrationName}`);
} finally {
  await client.end();
}
