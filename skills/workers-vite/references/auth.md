# Authentication

## Overview

Three auth methods, tried in order by the middleware:
1. **Session cookie** — browser auth via Google OAuth
2. **API token** — programmatic auth via `Bearer prefix_id_secret`
3. **MCP OAuth token** — MCP client auth via `Bearer mcp_<hex>`

## Google OAuth (`src/server/auth.ts`)

Three routes under `/auth`:

1. **`GET /auth/google`** — Generates a UUID nonce, stores it in `oauth_states` (10-min expiry), sets an httpOnly cookie, redirects to Google.
2. **`GET /auth/google/callback`** — Validates state (cookie + DB single-use nonce via `delete().returning()`), exchanges code for Google token, fetches userinfo, upserts user via `insert().onConflictDoUpdate()`, creates 30-day session.
3. **`POST /auth/logout`** — Deletes session row, clears cookie.

```ts
import { and, eq, gt, sql } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { getDb } from "./db/index.js";
import { oauthStates, sessions, users } from "./db/schema.js";

type AppEnv = { Bindings: Env };
const auth = new Hono<AppEnv>();

auth.get("/google", async (c) => {
  const nonce = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const db = getDb(c.env.DB);
  await db.insert(oauthStates).values({ nonce, expiresAt });

  setCookie(c, "oauth_state", nonce, {
    httpOnly: true, secure: true, sameSite: "Lax",
    path: "/auth/google/callback", maxAge: 10 * 60,
  });

  // Redirect to Google OAuth...
});

auth.get("/google/callback", async (c) => {
  // Validate state cookie + consume DB nonce
  const db = getDb(c.env.DB);
  const [row] = await db.delete(oauthStates)
    .where(and(eq(oauthStates.nonce, stateParam), gt(oauthStates.expiresAt, sql`datetime('now')`)))
    .returning({ nonce: oauthStates.nonce });

  // Exchange Google code, fetch userinfo...

  // Upsert user
  await db.insert(users).values({ id: crypto.randomUUID(), googleId, email, name, picture })
    .onConflictDoUpdate({
      target: users.googleId,
      set: { email, name, picture, updatedAt: new Date().toISOString() },
    });

  // Create session
  await db.insert(sessions).values({ id: sessionId, userId, expiresAt });
  setCookie(c, "session", sessionId, { httpOnly: true, secure: true, sameSite: "Lax", path: "/" });
});

auth.post("/logout", async (c) => {
  const sessionId = getCookie(c, "session");
  if (sessionId) {
    const db = getDb(c.env.DB);
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }
  deleteCookie(c, "session", { path: "/" });
  return c.json({ ok: true });
});
```

## Auth Middleware (`src/server/middleware.ts`)

Tries session, API token, then MCP OAuth token. Drizzle's typed selects produce the `User` type directly — no manual casting.

```ts
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { getDb } from "./db/index.js";
import { apiTokens, mcpOAuthTokens, sessions, users } from "./db/schema.js";
import { hashSecret, parseToken, timingSafeEqual } from "./tokens.js";

const now = sql`datetime('now')`;

async function authenticateSession(c): Promise<boolean> {
  const sessionId = getCookie(c, "session");
  if (!sessionId) return false;
  const db = getDb(c.env.DB);
  const row = await db.select({ /* all user fields */ })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .get();
  if (!row) return false;
  c.set("user", row);
  return true;
}

async function authenticateToken(c): Promise<boolean> {
  // Parse Bearer token, look up in apiTokens joined with users,
  // verify hash with timingSafeEqual.
  // Fire-and-forget last_used_at update via c.executionCtx.waitUntil().
}

export async function tryAuthenticate(c): Promise<boolean> {
  if (await authenticateSession(c)) return true;
  if (await authenticateToken(c)) return true;
  return false;
}

export async function authMiddleware(c, next) {
  if (await tryAuthenticate(c)) return next();
  return c.json({ error: "Unauthorized" }, 401);
}
```

## Token Utilities (`src/server/tokens.ts`)

Uses Web Crypto API. Token format: `prefix_id_secret` where id is 8 hex chars and secret is 32 hex chars. Only the SHA-256 hash of the secret is stored.

```ts
export async function hashSecret(secret: string): Promise<string> {
  const data = new TextEncoder().encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(hash));
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ab = fromHex(a);
  const bb = fromHex(b);
  let result = 0;
  for (let i = 0; i < ab.length; i++) result |= ab[i] ^ bb[i];
  return result === 0;
}

export async function generateToken(): Promise<{ id, secret, token, secretHash }> {
  const id = toHex(crypto.getRandomValues(new Uint8Array(4)));
  const secret = toHex(crypto.getRandomValues(new Uint8Array(16)));
  return { id, secret, token: `myapp_${id}_${secret}`, secretHash: await hashSecret(secret) };
}

export function parseToken(raw: string): { id, secret } | null {
  const parts = raw.split("_");
  if (parts.length !== 3 || parts[0] !== "myapp" || parts[1].length !== 8 || parts[2].length !== 32) return null;
  return { id: parts[1], secret: parts[2] };
}
```

## API Token Endpoints (`src/server/api-tokens.ts`)

CRUD for user-managed API tokens. Full token returned once on creation. Uses `update().returning()` to check affected rows.

```ts
// List — typed results, no casting
const results = await db.select({ id, name, expiresAt, revokedAt, lastUsedAt, createdAt })
  .from(apiTokens).where(eq(apiTokens.userId, user.id));

// Create — insert + return full token
await db.insert(apiTokens).values({ id, userId, name, secretHash, expiresAt });

// Revoke — soft delete with affected-row check
const [revoked] = await db.update(apiTokens)
  .set({ revokedAt: now, updatedAt: now })
  .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, user.id), isNull(apiTokens.revokedAt)))
  .returning({ id: apiTokens.id });
if (!revoked) return c.json({ error: "Not found" }, 404);
```
