import type { InferSelectModel } from "drizzle-orm";
import type { apiTokens, users } from "../server/db/schema.js";

export type User = InferSelectModel<typeof users>;

export type ApiToken = Pick<
	InferSelectModel<typeof apiTokens>,
	"id" | "name" | "expiresAt" | "revokedAt" | "lastUsedAt" | "createdAt"
>;

export interface CreateApiTokenResponse extends ApiToken {
	token: string;
}
