import { and, eq, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { User } from "../shared/types.js";
import { getDb } from "./db/index.js";
import { apiTokens } from "./db/schema.js";
import { generateToken } from "./tokens.js";

type AppEnv = {
	Bindings: Env;
	Variables: { user: User };
};

const apiTokensRoute = new Hono<AppEnv>();

apiTokensRoute.get("/", async (c) => {
	const user = c.get("user");
	const db = getDb(c.env.DB);

	const results = await db
		.select({
			id: apiTokens.id,
			name: apiTokens.name,
			expiresAt: apiTokens.expiresAt,
			revokedAt: apiTokens.revokedAt,
			lastUsedAt: apiTokens.lastUsedAt,
			createdAt: apiTokens.createdAt,
		})
		.from(apiTokens)
		.where(eq(apiTokens.userId, user.id))
		.orderBy(sql`${apiTokens.createdAt} DESC`);

	return c.json(results);
});

apiTokensRoute.post("/", async (c) => {
	const user = c.get("user");
	const body = await c.req.json<{ name: string; expiresAt?: string }>();

	if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
		return c.json({ error: "Name is required" }, 400);
	}

	if (body.expiresAt) {
		const d = new Date(body.expiresAt);
		if (Number.isNaN(d.getTime())) {
			return c.json({ error: "Invalid expiration date" }, 400);
		}
		if (d <= new Date()) {
			return c.json({ error: "Expiration must be in the future" }, 400);
		}
	}

	const { id, token, secretHash } = await generateToken();
	const db = getDb(c.env.DB);

	await db.insert(apiTokens).values({
		id,
		userId: user.id,
		name: body.name.trim(),
		secretHash,
		expiresAt: body.expiresAt || null,
	});

	const row = await db
		.select({
			id: apiTokens.id,
			name: apiTokens.name,
			expiresAt: apiTokens.expiresAt,
			revokedAt: apiTokens.revokedAt,
			lastUsedAt: apiTokens.lastUsedAt,
			createdAt: apiTokens.createdAt,
		})
		.from(apiTokens)
		.where(eq(apiTokens.id, id))
		.get();

	if (!row) {
		return c.json({ error: "Failed to create token" }, 500);
	}

	return c.json({ ...row, token }, 201);
});

apiTokensRoute.delete("/:id", async (c) => {
	const user = c.get("user");
	const tokenId = c.req.param("id");
	const db = getDb(c.env.DB);

	const now = new Date().toISOString();
	const [revoked] = await db
		.update(apiTokens)
		.set({ revokedAt: now, updatedAt: now })
		.where(
			and(
				eq(apiTokens.id, tokenId),
				eq(apiTokens.userId, user.id),
				isNull(apiTokens.revokedAt),
			),
		)
		.returning({ id: apiTokens.id });

	if (!revoked) {
		return c.json({ error: "Token not found or already revoked" }, 404);
	}

	return c.json({ ok: true });
});

export { apiTokensRoute as apiTokens };
