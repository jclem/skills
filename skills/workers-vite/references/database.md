# Database (Drizzle + D1)

## Schema (`src/server/db/schema.ts`)

The Drizzle schema is the single source of truth for all table definitions. Column names map from snake_case SQL to camelCase TypeScript via the second argument to column helpers (e.g., `text("google_id")` produces a column named `google_id` in SQL but `googleId` in TypeScript). Use `$defaultFn` for application-level defaults.

```ts
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text().primaryKey(),
  googleId: text("google_id").notNull().unique(),
  email: text().notNull(),
  name: text().notNull(),
  picture: text(),
  dayStartHour: integer("day_start_hour").notNull().default(0),
  timezone: text().notNull().default("America/New_York"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const sessions = sqliteTable("sessions", {
  id: text().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index("idx_sessions_user").on(t.userId),
]);

export const oauthStates = sqliteTable("oauth_states", {
  nonce: text().primaryKey(),
  expiresAt: text("expires_at").notNull(),
  metadata: text(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const apiTokens = sqliteTable("api_tokens", {
  id: text().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text().notNull(),
  secretHash: text("secret_hash").notNull(),
  expiresAt: text("expires_at"),
  revokedAt: text("revoked_at"),
  lastUsedAt: text("last_used_at"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index("idx_api_tokens_user").on(t.userId),
]);

// MCP OAuth tables follow the same pattern...
```

## Schema Patterns

- **Primary keys:** `text().primaryKey()` using `crypto.randomUUID()` (UUIDs)
- **Timestamps:** `text("created_at").notNull().$defaultFn(() => new Date().toISOString())` — application-level defaults via `$defaultFn`
- **Soft deletes:** Nullable `text("archived_at")` or `text("revoked_at")` columns
- **Foreign keys:** `.references(() => parentTable.id)` on the column definition
- **Indexes:** Defined in the third argument to `sqliteTable()` as an array
- **Enums:** `text({ enum: ["at_least", "no_more_than"] })` for typed string columns
- **JSON columns:** `text()` with manual `JSON.parse()`/`JSON.stringify()` in application code

## Database Helper (`src/server/db/index.ts`)

Wraps D1 with Drizzle. The `drizzle()` call is stateless and lightweight — safe to call per-request.

```ts
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema.js";

export function getDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof getDb>;
```

## Shared Types (`src/shared/types.ts`)

Base types are derived from the Drizzle schema with `InferSelectModel`. Composite types extend them manually.

```ts
import type { InferSelectModel } from "drizzle-orm";
import type { apiTokens, users } from "../server/db/schema.js";

export type User = InferSelectModel<typeof users>;

export type ApiToken = Pick<
  InferSelectModel<typeof apiTokens>,
  "id" | "name" | "expiresAt" | "revokedAt" | "lastUsedAt" | "createdAt"
>;
```

## Query Patterns

```ts
// Read (single row)
const user = await db.select().from(users).where(eq(users.id, id)).get();

// Read (multiple rows)
const rows = await db.select().from(users).where(eq(users.teamId, teamId));

// Insert
await db.insert(users).values({ id: crypto.randomUUID(), email, name });

// Upsert
await db.insert(users).values({ id, googleId, email, name })
  .onConflictDoUpdate({
    target: users.googleId,
    set: { email, name, updatedAt: new Date().toISOString() },
  });

// Update
await db.update(users).set({ name }).where(eq(users.id, id));

// Delete + return (single-use token consumption)
const [row] = await db.delete(oauthStates)
  .where(and(eq(oauthStates.nonce, nonce), gt(oauthStates.expiresAt, sql`datetime('now')`)))
  .returning({ nonce: oauthStates.nonce });

// Check affected rows via .returning()
const [revoked] = await db.update(apiTokens)
  .set({ revokedAt: now })
  .where(and(eq(apiTokens.id, id), isNull(apiTokens.revokedAt)))
  .returning({ id: apiTokens.id });
if (!revoked) return c.json({ error: "Not found" }, 404);

// Raw SQL for SQLite functions
import { sql } from "drizzle-orm";
const now = sql`datetime('now')`;
const sevenDaysAgo = sql`datetime('now', '-7 days')`;

// Batch operations
await db.batch([
  db.delete(apiTokens).where(and(isNotNull(apiTokens.revokedAt), lt(apiTokens.revokedAt, sevenDaysAgo))),
  db.delete(mcpOAuthAuthorizationCodes).where(lt(mcpOAuthAuthorizationCodes.expiresAt, now)),
]);
```

## Migrations

Drizzle generates migration SQL from schema diffs. Wrangler applies them to D1.

```sh
# 1. Edit src/server/db/schema.ts
# 2. Generate a migration file from the schema diff
mise run db:generate

# 3. Apply migrations
mise run db:migrate local   # Local D1
mise run db:migrate remote  # Production D1
```

The `migrations/meta/` directory contains Drizzle's snapshots and journal — commit these alongside the generated `.sql` files.
