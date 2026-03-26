import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
	id: text().primaryKey(),
	googleId: text("google_id").notNull().unique(),
	email: text().notNull(),
	name: text().notNull(),
	picture: text(),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text("updated_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export const sessions = sqliteTable(
	"sessions",
	{
		id: text().primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		expiresAt: text("expires_at").notNull(),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
		updatedAt: text("updated_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(t) => [index("idx_sessions_user").on(t.userId)],
);

export const oauthStates = sqliteTable("oauth_states", {
	nonce: text().primaryKey(),
	expiresAt: text("expires_at").notNull(),
	metadata: text(),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export const apiTokens = sqliteTable(
	"api_tokens",
	{
		id: text().primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		name: text().notNull(),
		secretHash: text("secret_hash").notNull(),
		expiresAt: text("expires_at"),
		revokedAt: text("revoked_at"),
		lastUsedAt: text("last_used_at"),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
		updatedAt: text("updated_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(t) => [index("idx_api_tokens_user").on(t.userId)],
);
