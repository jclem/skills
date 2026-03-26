import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { confirm, input, password, select } from "@inquirer/prompts";
import { $ } from "bun";

const SKILL_DIR = resolve(dirname(import.meta.filename), "..");
const TEMPLATE_DIR = join(SKILL_DIR, "assets/template");
const SCRIPTS_DIR = join(SKILL_DIR, "scripts");
const PROJECT_DIR = process.cwd();

// ── Helpers ──

function log(msg: string) {
	console.log(`\x1b[36m==>\x1b[0m ${msg}`);
}

function info(msg: string) {
	console.log(`    ${msg}`);
}

function warn(msg: string) {
	console.log(`\x1b[33m    ⚠ ${msg}\x1b[0m`);
}

// ── Validate directory ──

const ALLOWED = new Set([
	".",
	"..",
	".git",
	".claude",
	".agents",
	"mise.toml",
	".mise.local.toml",
	".tool-versions",
	"skills-lock.json",
]);

const entries = readdirSync(PROJECT_DIR, { withFileTypes: true });
const unexpected = entries
	.map((e) => e.name)
	.filter((name) => !ALLOWED.has(name) && !name.startsWith(".mise."));

if (unexpected.length > 0) {
	console.error(
		"Directory must be empty except for .git, .claude, and mise files. Found:",
	);
	for (const name of unexpected) console.error(`  ${name}`);
	process.exit(1);
}

// ── Gather input ──

const appName = await input({
	message: "App name (kebab-case)",
	default: basename(PROJECT_DIR),
	validate: (v) =>
		/^[a-z][a-z0-9-]*$/.test(v) || "Must be lowercase kebab-case",
});

const defaultTitle = appName
	.split("-")
	.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
	.join(" ");

const appTitle = await input({
	message: "App title",
	default: defaultTitle,
});

const tokenPrefix = await input({
	message: "API token prefix",
	default: appName.replace(/-/g, ""),
	validate: (v) =>
		/^[a-z][a-z0-9]*$/.test(v) || "Must be lowercase alphanumeric",
});

const colorScheme = await select({
	message: "Color scheme",
	choices: [
		{
			value: "folio",
			name: "Folio — warm parchment backgrounds, earthy brown accent",
		},
		{
			value: "cool-gray",
			name: "Cool gray — slate backgrounds, blue accent",
		},
		{
			value: "high-contrast",
			name: "High contrast — pure white/black, violet accent",
		},
	],
});

const setupDevVars = await confirm({
	message: "Set up Google OAuth credentials now?",
	default: false,
});

let googleClientId = "";
let googleClientSecret = "";

if (setupDevVars) {
	googleClientId = await input({ message: "Google Client ID" });
	googleClientSecret = await password({ message: "Google Client Secret" });
}

// ── Color palettes ──

const PALETTES: Record<string, { light: string; dark: string }> = {
	folio: {
		light: [
			"--bg0: #fffcf5; --bg1: #f4f1ea; --bg2: #e8e5dd; --bg3: #dddad2;",
			"--fg0: #2b2924; --fg1: #4d4a43; --fg2: #6e6a5f; --fg3: #9c9889;",
			"--accent: #8b7355; --highlight: #ede4d0; --error: #a04040; --warn: #8b7040;",
		].join("\n\t\t"),
		dark: [
			"--bg0: #1c1b18; --bg1: #252420; --bg2: #302e29; --bg3: #3d3a34;",
			"--fg0: #d5d2c8; --fg1: #b0ad9f; --fg2: #8a8778; --fg3: #5e5b50;",
			"--accent: #c4a882; --highlight: #3a3428; --error: #c86060; --warn: #c4a050;",
		].join("\n\t\t"),
	},
	"cool-gray": {
		light: [
			"--bg0: #ffffff; --bg1: #f4f4f5; --bg2: #e4e4e7; --bg3: #d4d4d8;",
			"--fg0: #18181b; --fg1: #3f3f46; --fg2: #71717a; --fg3: #a1a1aa;",
			"--accent: #2563eb; --highlight: #eff6ff; --error: #dc2626; --warn: #d97706;",
		].join("\n\t\t"),
		dark: [
			"--bg0: #09090b; --bg1: #18181b; --bg2: #27272a; --bg3: #3f3f46;",
			"--fg0: #fafafa; --fg1: #d4d4d8; --fg2: #a1a1aa; --fg3: #71717a;",
			"--accent: #60a5fa; --highlight: #172554; --error: #f87171; --warn: #fbbf24;",
		].join("\n\t\t"),
	},
	"high-contrast": {
		light: [
			"--bg0: #ffffff; --bg1: #f5f5f5; --bg2: #e5e5e5; --bg3: #d4d4d4;",
			"--fg0: #000000; --fg1: #262626; --fg2: #525252; --fg3: #737373;",
			"--accent: #7c3aed; --highlight: #f5f3ff; --error: #dc2626; --warn: #d97706;",
		].join("\n\t\t"),
		dark: [
			"--bg0: #000000; --bg1: #0a0a0a; --bg2: #171717; --bg3: #262626;",
			"--fg0: #ffffff; --fg1: #e5e5e5; --fg2: #a3a3a3; --fg3: #737373;",
			"--accent: #a78bfa; --highlight: #1e1b4b; --error: #f87171; --warn: #fbbf24;",
		].join("\n\t\t"),
	},
};

// ── Copy template ──

console.log("");
log(`Creating ${appName} (${appTitle})`);
info(`Token prefix: ${tokenPrefix}_`);
info(`Color scheme: ${colorScheme}`);
console.log("");

log("Copying template...");
await $`cp -R ${TEMPLATE_DIR}/. .`.quiet();

// ── Substitute placeholders ──

log("Applying configuration...");

const palette = PALETTES[colorScheme];
const CSS_REPLACEMENT = `/* ${colorScheme} */
\t:root {
\t\t${palette.light}
\t}

\t@media (prefers-color-scheme: dark) {
\t\t:root {
\t\t\t${palette.dark}
\t\t}
\t}`;

const filesToPatch = await $`find . -type f \\( -name '*.ts' -o -name '*.tsx' -o -name '*.json' -o -name '*.jsonc' -o -name '*.toml' -o -name '*.html' -o -name '*.css' \\)`.text();

for (const file of filesToPatch.trim().split("\n")) {
	if (!file) continue;
	let content = await Bun.file(file).text();
	content = content.replaceAll("__APP_NAME__", appName);
	content = content.replaceAll("__APP_TITLE__", appTitle);
	content = content.replaceAll("__TOKEN_PREFIX__", tokenPrefix);

	// Replace color scheme block in CSS
	if (file.endsWith(".css")) {
		content = content.replace(
			/\/\* __COLOR_SCHEME__ \*\/\n\t:root \{[^}]+\}\n\n\t@media \(prefers-color-scheme: dark\) \{\n\t\t:root \{[^}]+\}\n\t\}/s,
			CSS_REPLACEMENT,
		);
	}

	await Bun.write(file, content);
}

// ── Install dependencies ──

console.log("");
log("Installing dependencies...");
await $`${SCRIPTS_DIR}/install-deps.sh`;

// ── Set compatibility date from installed wrangler ──

let compatDate: string;
const wranglerTemplate = join(
	PROJECT_DIR,
	"node_modules/wrangler/templates/remoteBindings/wrangler.jsonc",
);

if (existsSync(wranglerTemplate)) {
	const templateContent = await Bun.file(wranglerTemplate).text();
	const match = templateContent.match(/\d{4}-\d{2}-\d{2}/);
	compatDate = match ? match[0] : `${new Date().toISOString().slice(0, 7)}-01`;
} else {
	compatDate = `${new Date().toISOString().slice(0, 7)}-01`;
}

info(`Compatibility date: ${compatDate}`);
const wranglerJsonc = await Bun.file("wrangler.jsonc").text();
await Bun.write(
	"wrangler.jsonc",
	wranglerJsonc.replace("__COMPAT_DATE__", compatDate),
);

// ── Create D1 database ──

console.log("");
log("Creating D1 database...");

let dbId = "";
try {
	const result =
		await $`bunx wrangler d1 create ${appName}-db 2>&1`.text();
	const match = result.match(/"database_id":\s*"([^"]+)"/);
	if (match) {
		dbId = match[1];
		info(`Database ID: ${dbId}`);
		const content = await Bun.file("wrangler.jsonc").text();
		await Bun.write("wrangler.jsonc", content.replace("__DB_ID__", dbId));
	}
} catch {
	warn(
		"Failed to create D1 database. Create it manually and update wrangler.jsonc.",
	);
}

// ── Generate and apply migration ──

console.log("");
log("Generating initial migration...");
await $`bunx drizzle-kit generate`;

console.log("");
log("Applying migration to local D1...");
await $`bunx wrangler d1 migrations apply ${appName}-db --local`;

// ── Write .dev.vars ──

if (setupDevVars && googleClientId && googleClientSecret) {
	console.log("");
	log("Writing .dev.vars...");
	await Bun.write(
		".dev.vars",
		`GOOGLE_CLIENT_ID=${googleClientId}\nGOOGLE_CLIENT_SECRET=${googleClientSecret}\n`,
	);
}

// ── Done ──

console.log("");
log("Done!");
console.log("");

if (!setupDevVars) {
	console.log("  Create .dev.vars with your Google OAuth credentials:");
	console.log("    GOOGLE_CLIENT_ID=...");
	console.log("    GOOGLE_CLIENT_SECRET=...");
	console.log("");
}

console.log("  Start the dev server:");
console.log("    mise run dev");
console.log("");
console.log("  When ready, apply migrations to production:");
console.log("    mise run db:migrate remote");
console.log("");
