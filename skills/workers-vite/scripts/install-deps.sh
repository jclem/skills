#!/usr/bin/env bash
set -euo pipefail

# Install all dependencies for a workers-vite project.
# Run from the project root after bun init.

bun add \
  @modelcontextprotocol/sdk@latest \
  @tanstack/react-query@latest \
  @tanstack/react-router@latest \
  drizzle-orm@latest \
  hono@latest \
  react@latest \
  react-dom@latest \
  zod@latest

bun add -d \
  @biomejs/biome@latest \
  @cloudflare/vite-plugin@latest \
  @cloudflare/workers-types@latest \
  @tailwindcss/vite@latest \
  @tanstack/router-plugin@latest \
  @types/react@latest \
  @types/react-dom@latest \
  @vitejs/plugin-react@latest \
  drizzle-kit@latest \
  tailwindcss@latest \
  typescript@latest \
  vite@latest \
  wrangler@latest
