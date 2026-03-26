import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { confirm, input, password, select } from "@inquirer/prompts";
import { $ } from "bun";

const SKILL_DIR = resolve(dirname(import.meta.filename), "..");
const TEMPLATE_DIR = join(SKILL_DIR, "assets/template");
const SCRIPTS_DIR = join(SKILL_DIR, "scripts");
const PROJECT_DIR = process.cwd();

// ── Formatting ──

const c = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	cyan: "\x1b[36m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
	magenta: "\x1b[35m",
	gray: "\x1b[90m",
};

function banner() {
	console.log("");
	console.log(
		`${c.cyan}${c.bold}  ╭──────────────────────────────────╮${c.reset}`,
	);
	console.log(
		`${c.cyan}${c.bold}  │  workers-vite                    │${c.reset}`,
	);
	console.log(
		`${c.cyan}${c.bold}  │${c.reset}${c.dim}  Cloudflare Workers + Vite + React ${c.reset}${c.cyan}${c.bold}│${c.reset}`,
	);
	console.log(
		`${c.cyan}${c.bold}  ╰──────────────────────────────────╯${c.reset}`,
	);
	console.log("");
}

function step(n: number, total: number, msg: string) {
	const progress = `${c.dim}[${n}/${total}]${c.reset}`;
	console.log(`\n  ${progress} ${c.cyan}${c.bold}${msg}${c.reset}`);
}

function done(msg: string) {
	console.log(`       ${c.green}+${c.reset} ${msg}`);
}

function detail(msg: string) {
	console.log(`       ${c.dim}${msg}${c.reset}`);
}

function warn(msg: string) {
	console.log(`       ${c.yellow}! ${msg}${c.reset}`);
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
		`\n  ${c.red}Directory must be empty except for .git, .claude, and mise files.${c.reset}`,
	);
	console.error(`  ${c.dim}Found:${c.reset}`);
	for (const name of unexpected)
		console.error(`    ${c.red}-${c.reset} ${name}`);
	console.error("");
	process.exit(1);
}

// ── Gather input ──

banner();

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
			name: "Folio — warm parchment, earthy brown accent",
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

// ── Summary ──

const TOTAL_STEPS = 6;

console.log("");
console.log(
	`  ${c.bold}${appTitle}${c.reset} ${c.dim}(${appName})${c.reset}`,
);
console.log(
	`  ${c.dim}token: ${tokenPrefix}_ ${c.reset}${c.dim}|${c.reset} ${c.dim}theme: ${colorScheme}${c.reset}`,
);

// ── Step 1: Copy template ──

step(1, TOTAL_STEPS, "Scaffolding project");
await $`cp -R ${TEMPLATE_DIR}/. .`.quiet();
done("Copied template files");

// ── Step 2: Apply configuration ──

step(2, TOTAL_STEPS, "Applying configuration");

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

const filesToPatch =
	await $`find . -type f \\( -name '*.ts' -o -name '*.tsx' -o -name '*.json' -o -name '*.jsonc' -o -name '*.toml' -o -name '*.html' -o -name '*.css' \\)`.text();

let patchCount = 0;
for (const file of filesToPatch.trim().split("\n")) {
	if (!file) continue;
	let content = await Bun.file(file).text();
	const before = content;
	content = content.replaceAll("__APP_NAME__", appName);
	content = content.replaceAll("__APP_TITLE__", appTitle);
	content = content.replaceAll("__TOKEN_PREFIX__", tokenPrefix);

	if (file.endsWith(".css")) {
		content = content.replace(
			/\/\* __COLOR_SCHEME__ \*\/\n\t:root \{[^}]+\}\n\n\t@media \(prefers-color-scheme: dark\) \{\n\t\t:root \{[^}]+\}\n\t\}/s,
			CSS_REPLACEMENT,
		);
	}

	if (content !== before) {
		patchCount++;
		await Bun.write(file, content);
	}
}
done(`Patched ${patchCount} files`);

// ── Step 3: Install dependencies ──

step(3, TOTAL_STEPS, "Installing dependencies");
await $`${SCRIPTS_DIR}/install-deps.sh`.quiet();

// Extract compat date from installed wrangler
let compatDate: string;
const wranglerTemplate = join(
	PROJECT_DIR,
	"node_modules/wrangler/templates/remoteBindings/wrangler.jsonc",
);

if (existsSync(wranglerTemplate)) {
	const templateContent = await Bun.file(wranglerTemplate).text();
	const match = templateContent.match(/\d{4}-\d{2}-\d{2}/);
	compatDate = match
		? match[0]
		: `${new Date().toISOString().slice(0, 7)}-01`;
} else {
	compatDate = `${new Date().toISOString().slice(0, 7)}-01`;
}

const wranglerJsonc = await Bun.file("wrangler.jsonc").text();
await Bun.write(
	"wrangler.jsonc",
	wranglerJsonc.replace("__COMPAT_DATE__", compatDate),
);

done("Installed packages");
detail(`Compatibility date: ${compatDate}`);

// ── Step 4: Create D1 database ──

step(4, TOTAL_STEPS, "Creating D1 database");

try {
	const result =
		await $`bunx wrangler d1 create ${appName}-db 2>&1`.quiet().text();
	const match = result.match(/"database_id":\s*"([^"]+)"/);
	if (match) {
		const dbId = match[1];
		const content = await Bun.file("wrangler.jsonc").text();
		await Bun.write("wrangler.jsonc", content.replace("__DB_ID__", dbId));
		done(`${appName}-db`);
		detail(dbId);
	}
} catch {
	warn("Could not create D1 database (update wrangler.jsonc manually)");
}

// ── Step 5: Generate and apply migration ──

step(5, TOTAL_STEPS, "Setting up database schema");
await $`bunx drizzle-kit generate`.quiet();
done("Generated initial migration");
await $`bunx wrangler d1 migrations apply ${appName}-db --local`.quiet();
done("Applied to local D1");

// ── Step 6: Write .dev.vars ──

step(6, TOTAL_STEPS, "Finishing up");

if (setupDevVars && googleClientId && googleClientSecret) {
	await Bun.write(
		".dev.vars",
		`GOOGLE_CLIENT_ID=${googleClientId}\nGOOGLE_CLIENT_SECRET=${googleClientSecret}\n`,
	);
	done("Wrote .dev.vars");
}

done("Project ready");

// ── Final output ──

console.log("");
console.log(
	`  ${c.green}${c.bold}All done!${c.reset} ${c.dim}Here's what's next:${c.reset}`,
);
console.log("");

if (!setupDevVars) {
	console.log(`  ${c.yellow}1.${c.reset} Create ${c.bold}.dev.vars${c.reset} with your Google OAuth credentials:`);
	console.log(`     ${c.dim}GOOGLE_CLIENT_ID=...${c.reset}`);
	console.log(`     ${c.dim}GOOGLE_CLIENT_SECRET=...${c.reset}`);
	console.log("");
	console.log(`  ${c.yellow}2.${c.reset} Start developing:`);
} else {
	console.log(`  ${c.yellow}1.${c.reset} Start developing:`);
}

console.log(`     ${c.bold}mise run dev${c.reset}`);
console.log("");
console.log(
	`  ${c.dim}When ready to deploy:  mise run db:migrate remote${c.reset}`,
);
console.log(
	`  ${c.dim}                       mise run deploy${c.reset}`,
);
console.log("");
