# MCP Server

## MCP Route (`src/server/mcp.ts`)

Uses `WebStandardStreamableHTTPServerTransport` with Hono. A new `McpServer` instance is created per request (stateless). The MCP server receives a Drizzle `Db` instance, not raw D1.

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { User } from "../shared/types.js";
import type { Db } from "./db/index.js";
import { getDb } from "./db/index.js";
import { things } from "./db/schema.js";

type AppEnv = { Bindings: Env; Variables: { user: User } };

function createMcpServer(db: Db, user: User): McpServer {
  const server = new McpServer(
    { name: "my-app", version: "1.0.0" },
    { capabilities: { logging: {} } },
  );

  server.registerTool(
    "list_things",
    {
      title: "List Things",
      description: "List all things for the current user.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const rows = await db.select().from(things).where(eq(things.userId, user.id));
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    },
  );

  return server;
}

const mcpRoute = new Hono<AppEnv>();

mcpRoute.post("/", async (c) => {
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  const db = getDb(c.env.DB);
  const server = createMcpServer(db, c.get("user"));
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
});

mcpRoute.delete("/", async (c) => {
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  const db = getDb(c.env.DB);
  const server = createMcpServer(db, c.get("user"));
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
});

mcpRoute.get("/", (c) => c.text("MCP endpoint. Use POST with JSON-RPC.", 405));

export { mcpRoute };
```

## MCP OAuth (`src/server/mcp-oauth.ts`)

Implements the OAuth flow that MCP clients use to authenticate. Separate from browser Google OAuth.

### Discovery Endpoints (no auth)

- `GET /.well-known/oauth-protected-resource` — RFC 9728 resource metadata
- `GET /.well-known/oauth-authorization-server` — RFC 8414 server metadata

### Registration

- `POST /oauth/register` — RFC 7591 dynamic client registration. Validates against `OAuthClientMetadataSchema` from the MCP SDK.

### Authorization Flow

- `GET /oauth/authorize` — Requires PKCE S256. If user has a browser session, issues auth code directly. Otherwise, stores MCP params in `oauth_states.metadata` and redirects through Google OAuth.
- `GET /oauth/callback` — Google OAuth callback for MCP flows. Exchanges Google code, upserts user, issues MCP authorization code, redirects to MCP client.
- `POST /oauth/token` — Two grant types:
  - `authorization_code` — Validates PKCE, consumes code via `delete().returning()`, issues `mcp_`-prefixed access token (1h) + `mcpr_`-prefixed refresh token (30d).
  - `refresh_token` — Revokes old pair, issues fresh pair (token rotation).

### Key Implementation Details

- All tokens stored as SHA-256 hashes
- PKCE S256 verification: `base64url(SHA-256(code_verifier)) === code_challenge`
- Loopback redirect URI matching: per RFC 8252 Section 7.3, port is ignored for `127.0.0.1`, `::1`, `localhost`
- Client secret verification uses timing-safe comparison
- MCP auth params are tunneled through Google OAuth via the `metadata` column on `oauth_states`
