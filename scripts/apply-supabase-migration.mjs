/**
 * Apply Supabase profile / watch-history tables from the repo migration file.
 *
 * You do NOT need to create auth.users — Supabase already has it.
 * This script creates public.profiles, watch_history, watch_progress, watch_later.
 *
 * Setup:
 *   1. Supabase Dashboard → Project Settings → Database
 *   2. Copy the "URI" connection string (use the database password you set at project creation)
 *   3. Add to .env.local:
 *        SUPABASE_DB_URL=postgresql://postgres.[ref]:[PASSWORD]@...supabase.com:5432/postgres
 *   4. Run: npm run supabase:migrate
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { loadMongoEnv, TEAVIE_ROOT } = require(path.join(__dirname, "lib/mongoEnv.cjs"));

loadMongoEnv();

const dbUrl = process.env.SUPABASE_DB_URL?.trim();
if (!dbUrl) {
  console.error(`
Missing SUPABASE_DB_URL in .env.local

Get it from Supabase Dashboard → Project Settings → Database → Connection string → URI
(use the password you chose when creating the project).

Example:
  SUPABASE_DB_URL=postgresql://postgres.axxagzjzwvkpcqjnpttx:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres

Or paste the full SQL in Dashboard → SQL Editor instead:
  supabase/migrations/001_user_profiles.sql
`);
  process.exit(1);
}

const sqlPath = path.join(TEAVIE_ROOT, "supabase/migrations/001_user_profiles.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const { Client } = await import("pg");
const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log("Connected. Applying migration…");
  await client.query(sql);
  console.log("Done. Tables created:");
  console.log("  - public.profiles");
  console.log("  - public.watch_history");
  console.log("  - public.watch_progress");
  console.log("  - public.watch_later");
  console.log("\nNext: enable Google under Authentication → Providers, then sign in on Teavie.");
} catch (err) {
  console.error("Migration failed:", err.message);
  if (/already exists/i.test(String(err.message))) {
    console.error("\nSome objects may already exist. Open SQL Editor and run only the missing parts,");
    console.error("or drop existing policies/tables first if you are resetting.");
  }
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
