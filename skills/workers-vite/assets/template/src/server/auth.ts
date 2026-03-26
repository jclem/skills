import { and, eq, gt, sql } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { getDb } from "./db/index.js";
import { oauthStates, sessions, users } from "./db/schema.js";

type AppEnv = {
	Bindings: Env;
};

const auth = new Hono<AppEnv>();

auth.get("/google", async (c) => {
	const nonce = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
	const redirectUri =
		c.env.OAUTH_REDIRECT_URI ??
		new URL("/auth/google/callback", c.req.url).toString();

	const db = getDb(c.env.DB);
	await db.insert(oauthStates).values({ nonce, expiresAt });

	setCookie(c, "oauth_state", nonce, {
		httpOnly: true,
		secure: true,
		sameSite: "Lax",
		path: "/auth/google/callback",
		maxAge: 10 * 60,
	});

	const params = new URLSearchParams({
		client_id: c.env.GOOGLE_CLIENT_ID,
		redirect_uri: redirectUri,
		response_type: "code",
		scope: "openid email profile",
		access_type: "offline",
		prompt: "consent",
		state: nonce,
	});

	return c.redirect(
		`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
	);
});

auth.get("/google/callback", async (c) => {
	const code = c.req.query("code");
	if (!code) {
		return c.text("Missing authorization code", 400);
	}

	const stateParam = c.req.query("state");
	const stateCookie = getCookie(c, "oauth_state");
	deleteCookie(c, "oauth_state", { path: "/auth/google/callback" });

	if (!stateParam || !stateCookie || stateParam !== stateCookie) {
		return c.text("Invalid state parameter", 400);
	}

	const db = getDb(c.env.DB);
	const [row] = await db
		.delete(oauthStates)
		.where(
			and(
				eq(oauthStates.nonce, stateParam),
				gt(oauthStates.expiresAt, sql`datetime('now')`),
			),
		)
		.returning({ nonce: oauthStates.nonce });

	if (!row) {
		return c.text("State expired or already used", 400);
	}

	const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			code,
			client_id: c.env.GOOGLE_CLIENT_ID,
			client_secret: c.env.GOOGLE_CLIENT_SECRET,
			redirect_uri:
				c.env.OAUTH_REDIRECT_URI ??
				new URL("/auth/google/callback", c.req.url).toString(),
			grant_type: "authorization_code",
		}),
	});

	if (!tokenRes.ok) {
		return c.text("Failed to exchange authorization code", 500);
	}

	const tokens = (await tokenRes.json()) as { access_token: string };

	const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
		headers: { Authorization: `Bearer ${tokens.access_token}` },
	});

	if (!userRes.ok) {
		return c.text("Failed to fetch user info", 500);
	}

	const googleUser = (await userRes.json()) as {
		id: string;
		email: string;
		name: string;
		picture: string;
	};

	const userId = crypto.randomUUID();
	await db
		.insert(users)
		.values({
			id: userId,
			googleId: googleUser.id,
			email: googleUser.email,
			name: googleUser.name,
			picture: googleUser.picture,
		})
		.onConflictDoUpdate({
			target: users.googleId,
			set: {
				email: googleUser.email,
				name: googleUser.name,
				picture: googleUser.picture,
				updatedAt: new Date().toISOString(),
			},
		});

	const user = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.googleId, googleUser.id))
		.get();

	const actualUserId = user?.id as string;

	const sessionId = crypto.randomUUID();
	const expiresAt = new Date(
		Date.now() + 30 * 24 * 60 * 60 * 1000,
	).toISOString();

	await db
		.insert(sessions)
		.values({ id: sessionId, userId: actualUserId, expiresAt });

	setCookie(c, "session", sessionId, {
		httpOnly: true,
		secure: true,
		sameSite: "Lax",
		path: "/",
		maxAge: 30 * 24 * 60 * 60,
	});

	return c.redirect("/");
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

export { auth };
