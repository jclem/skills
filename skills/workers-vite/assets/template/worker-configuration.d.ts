interface Env {
	DB: D1Database;
	ASSETS: Fetcher;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	OAUTH_REDIRECT_URI?: string;
}
