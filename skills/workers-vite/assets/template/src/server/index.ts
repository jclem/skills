import { and, isNotNull, lt, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { User } from "../shared/types.js";
import { apiTokens } from "./api-tokens.js";
import { auth } from "./auth.js";
import { getDb } from "./db/index.js";
import { apiTokens as apiTokensTable } from "./db/schema.js";
import { authMiddleware } from "./middleware.js";

type AppEnv = {
	Bindings: Env;
	Variables: { user: User };
};

const app = new Hono<AppEnv>();

// Auth routes (no auth middleware)
app.route("/auth", auth);

// API routes (require auth)
app.use("/api/*", authMiddleware);

app.get("/api/me", (c) => {
	return c.json(c.get("user"));
});

app.route("/api/tokens", apiTokens);

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

		await db
			.delete(apiTokensTable)
			.where(
				and(
					isNotNull(apiTokensTable.revokedAt),
					lt(apiTokensTable.revokedAt, sevenDaysAgo),
				),
			);
	},
};
