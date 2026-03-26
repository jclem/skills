import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import type { User } from "../shared/types.js";
import { getDb } from "./db/index.js";
import { apiTokens, sessions, users } from "./db/schema.js";
import { hashSecret, parseToken, timingSafeEqual } from "./tokens.js";

type AppEnv = {
	Bindings: Env;
	Variables: { user: User };
};

const now = sql`datetime('now')`;

async function authenticateSession(c: Context<AppEnv>): Promise<boolean> {
	const sessionId = getCookie(c, "session");
	if (!sessionId) return false;

	const db = getDb(c.env.DB);
	const row = await db
		.select({
			id: users.id,
			googleId: users.googleId,
			email: users.email,
			name: users.name,
			picture: users.picture,
			createdAt: users.createdAt,
			updatedAt: users.updatedAt,
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
		.get();

	if (!row) return false;
	c.set("user", row);
	return true;
}

async function authenticateToken(c: Context<AppEnv>): Promise<boolean> {
	const auth = c.req.header("Authorization");
	if (!auth?.startsWith("Bearer ")) return false;

	const token = auth.slice(7);
	const parsed = parseToken(token);
	if (!parsed) return false;

	const db = getDb(c.env.DB);
	const row = await db
		.select({
			secretHash: apiTokens.secretHash,
			id: users.id,
			googleId: users.googleId,
			email: users.email,
			name: users.name,
			picture: users.picture,
			createdAt: users.createdAt,
			updatedAt: users.updatedAt,
		})
		.from(apiTokens)
		.innerJoin(users, eq(apiTokens.userId, users.id))
		.where(
			and(
				eq(apiTokens.id, parsed.id),
				isNull(apiTokens.revokedAt),
				or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, now)),
			),
		)
		.get();

	if (!row) return false;

	const providedHash = await hashSecret(parsed.secret);
	if (!timingSafeEqual(providedHash, row.secretHash)) return false;

	c.set("user", {
		id: row.id,
		googleId: row.googleId,
		email: row.email,
		name: row.name,
		picture: row.picture,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	});

	c.executionCtx.waitUntil(
		db
			.update(apiTokens)
			.set({ lastUsedAt: new Date().toISOString() })
			.where(eq(apiTokens.id, parsed.id)),
	);

	return true;
}

export async function tryAuthenticate(c: Context<AppEnv>): Promise<boolean> {
	if (await authenticateSession(c)) return true;
	if (await authenticateToken(c)) return true;
	return false;
}

export async function authMiddleware(c: Context<AppEnv>, next: Next) {
	if (await tryAuthenticate(c)) return next();
	return c.json({ error: "Unauthorized" }, 401);
}
