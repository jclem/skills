# Server Setup

## Hono App Type Pattern

Every server module repeats this type. It maps the Cloudflare `Env` interface to Hono's `Bindings` and exposes the user via `Variables`. Create the Drizzle instance with `getDb(c.env.DB)` at the top of each handler.

```ts
import { Hono } from "hono";
import type { User } from "../shared/types.js";
import { getDb } from "./db/index.js";

type AppEnv = {
  Bindings: Env;
  Variables: { user: User };
};

const myRoutes = new Hono<AppEnv>();

myRoutes.get("/", async (c) => {
  const user = c.get("user");
  const db = getDb(c.env.DB);
  // Use db.select(), db.insert(), db.update(), db.delete()...
});
```

## Worker Entry (`src/server/index.ts`)

Hono app with typed env bindings. Routes are composed from separate modules. The SPA fallback catches all unmatched GET requests and serves `index.html` — but only if the path has no file extension.

```ts
import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { User } from "../shared/types.js";
import { auth } from "./auth.js";
import { getDb } from "./db/index.js";
import { apiTokens, mcpOAuthAuthorizationCodes, mcpOAuthTokens, users } from "./db/schema.js";
import { authMiddleware, tryAuthenticate } from "./middleware.js";
import { mcpOAuth } from "./mcp-oauth.js";
import { mcpRoute } from "./mcp.js";

type AppEnv = {
  Bindings: Env;
  Variables: { user: User };
};

const app = new Hono<AppEnv>();

// MCP OAuth discovery and endpoints (no auth middleware — these ARE the auth mechanism)
app.route("/", mcpOAuth);

// Auth routes (no auth middleware)
app.route("/auth", auth);

// API routes (require auth)
app.use("/api/*", authMiddleware);

app.get("/api/me", (c) => {
  return c.json(c.get("user"));
});

// Mount domain-specific route modules here
// app.route("/api/things", things);

// MCP endpoint (require auth, with OAuth discovery via WWW-Authenticate)
app.use("/mcp", async (c, next) => {
  if (await tryAuthenticate(c)) return next();
  const origin = new URL(c.req.url).origin;
  return c.json({ error: "Unauthorized" }, 401, {
    "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
  });
});
app.route("/mcp", mcpRoute);

// SPA fallback — serve index.html for client-side routes only.
// Requests with a file extension are left for ASSETS to handle directly.
app.get("*", (c) => {
  const url = new URL(c.req.url);
  if (/\.\w+$/.test(url.pathname)) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  url.pathname = "/";
  return c.env.ASSETS.fetch(new Request(url, c.req.raw));
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    const db = getDb(env.DB);
    const sevenDaysAgo = sql`datetime('now', '-7 days')`;
    const now = sql`datetime('now')`;

    await db.batch([
      db.delete(apiTokens).where(
        and(isNotNull(apiTokens.revokedAt), lt(apiTokens.revokedAt, sevenDaysAgo)),
      ),
      db.delete(mcpOAuthAuthorizationCodes).where(
        lt(mcpOAuthAuthorizationCodes.expiresAt, now),
      ),
      db.delete(mcpOAuthTokens).where(
        and(isNotNull(mcpOAuthTokens.revokedAt), lt(mcpOAuthTokens.revokedAt, sevenDaysAgo)),
      ),
    ]);
  },
};
```
