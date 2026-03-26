#!/usr/bin/env bash
set -euo pipefail

# Bootstrap a new Cloudflare Workers + Vite project.
#
# Usage: bootstrap.sh <app-name> [app-title] [token-prefix]
#
# Arguments:
#   app-name      Kebab-case project name (e.g. my-app)
#   app-title     Display name (default: derived from app-name, e.g. "My App")
#   token-prefix  API token prefix (default: derived from app-name without hyphens, e.g. "myapp")
#
# Run from an empty directory (or one containing only .git and mise files).

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE_DIR="$SKILL_DIR/assets/template"

if [[ $# -lt 1 ]]; then
	echo "usage: $(basename "$0") <app-name> [app-title] [token-prefix]" >&2
	exit 1
fi

APP_NAME="$1"
APP_TITLE="${2:-$(echo "$APP_NAME" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)}1')}"
TOKEN_PREFIX="${3:-$(echo "$APP_NAME" | tr -d '-')}"
# Use the first day of the current month as a safe compatibility date.
# Today's date may be ahead of the installed wrangler runtime.
COMPAT_DATE="$(date +%Y-%m)-01"

# Verify directory is empty (except .git and mise files)
shopt -s dotglob nullglob
unexpected=()
for entry in * .*; do
	[[ $entry == "." || $entry == ".." ]] && continue
	case "$entry" in
	.git | .claude | .agents | mise.toml | .mise.local.toml | .tool-versions | .mise.*.toml | skills-lock.json) ;;
	*)
		unexpected+=("$entry")
		;;
	esac
done
shopt -u dotglob nullglob

if ((${#unexpected[@]} > 0)); then
	printf 'directory must be empty except for .git and mise files; found:\n' >&2
	printf '  %s\n' "${unexpected[@]}" >&2
	exit 1
fi

echo "==> Creating $APP_NAME ($APP_TITLE)"
echo "    Token prefix: ${TOKEN_PREFIX}_"
echo "    Compat date:  $COMPAT_DATE"
echo ""

# Copy template
cp -R "$TEMPLATE_DIR"/. .

# Substitute placeholders
find . -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.json' -o -name '*.jsonc' -o -name '*.toml' -o -name '*.html' -o -name '*.css' \) | while read -r file; do
	sed -i '' \
		-e "s/__APP_NAME__/$APP_NAME/g" \
		-e "s/__APP_TITLE__/$APP_TITLE/g" \
		-e "s/__TOKEN_PREFIX__/$TOKEN_PREFIX/g" \
		-e "s/__COMPAT_DATE__/$COMPAT_DATE/g" \
		"$file"
done

# Install dependencies
echo "==> Installing dependencies..."
"$SCRIPT_DIR/install-deps.sh"

# Create D1 database
echo ""
echo "==> Creating D1 database..."
DB_OUTPUT=$(bunx wrangler d1 create "${APP_NAME}-db" 2>&1) || {
	echo "$DB_OUTPUT"
	echo ""
	echo "WARNING: Failed to create D1 database. You'll need to create it manually"
	echo "and update the database_id in wrangler.jsonc."
	DB_OUTPUT=""
}

if [[ -n "$DB_OUTPUT" ]]; then
	DB_ID=$(echo "$DB_OUTPUT" | grep -o '"database_id": "[^"]*"' | head -1 | cut -d'"' -f4)
	if [[ -n "$DB_ID" ]]; then
		sed -i '' "s/__DB_ID__/$DB_ID/g" wrangler.jsonc
		echo "    Database ID: $DB_ID"
	fi
fi

# Generate initial migration
echo ""
echo "==> Generating initial migration..."
bunx drizzle-kit generate

# Apply migration locally
echo ""
echo "==> Applying migration to local D1..."
bunx wrangler d1 migrations apply "${APP_NAME}-db" --local

echo ""
echo "==> Done! Next steps:"
echo ""
echo "  1. Create .dev.vars with your Google OAuth credentials:"
echo "     GOOGLE_CLIENT_ID=..."
echo "     GOOGLE_CLIENT_SECRET=..."
echo ""
echo "  2. Start the dev server:"
echo "     mise run dev"
echo ""
echo "  3. When ready, apply migrations to production:"
echo "     mise run db:migrate remote"
echo ""
