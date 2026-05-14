---
name: open-pull-request
description: Open GitHub pull requests from local branches with repository-appropriate tooling and a required Notion issue ID title prefix. Use when the user asks to open, create, draft, publish, or prepare a pull request, especially in the Envelope repository where PR titles must begin with an issue ID from the Notion Issues database at https://www.notion.so/jclem/35e6361404d980d9aac6c4c12e141442?v=35e6361404d980989431000c25353ced&source=copy_link.
---

# Open Pull Request

## Overview

Open pull requests from the current branch while preserving the repository's git workflow and enforcing the title format:

```txt
<ISSUE-ID>: <imperative PR title>
```

The `<ISSUE-ID>` must come from the `ID` property of an issue in the Notion Issues database:

- Default view: `https://www.notion.so/jclem/35e6361404d980d9aac6c4c12e141442?v=35e6361404d980989431000c25353ced&source=copy_link`
- Database: `https://www.notion.so/35e6361404d980d9aac6c4c12e141442`
- Data source: `collection://35e63614-04d9-80c5-9c4e-000bb5b708d6`

## Workflow

1. Inspect the local git state.
   - Confirm the current branch and upstream.
   - Check for uncommitted changes and do not include unrelated work.
   - If `.git/av/av.db` exists, use the `av-cli` skill for stacked PR creation or updates.

2. Resolve the Notion issue.
   - Use the Notion tools or the `envelope-issues` skill when available.
   - Query the Notion Issues database or default view to find the issue that matches the branch, commit work, or user-provided issue reference.
   - Read the issue's `ID` property directly from Notion. Do not infer or invent the issue ID.
   - If no matching issue can be identified, stop and ask the user which issue to use before opening the PR.

3. Draft the PR title.
   - Prefix the title with the exact Notion issue ID, followed by a colon and a space.
   - Use an imperative subject after the prefix.
   - Do not use conventional-commit, package, or area prefixes unless they are already part of the issue ID.

   Good:

   ```txt
   AJAX-267: Document defense-in-depth ownership filter
   ```

   Bad:

   ```txt
   Document defense-in-depth ownership filter
   auth: AJAX-267 document defense-in-depth ownership filter
   AJAX-267 - Document defense-in-depth ownership filter
   ```

4. Draft the PR body.
   - Always honor the repository's GitHub pull request template when one exists. The template supersedes all other PR body guidance in this skill.
   - Check the canonical typical path `.github/pull_request_template.md` first. GitHub also supports `pull_request_template.md` in the repository root or `docs/`, and multiple templates under `PULL_REQUEST_TEMPLATE/` in the root, `docs/`, or `.github/`.
   - Preserve the template's required headings, prompts, checklist items, and issue-linking conventions unless the user explicitly asks for a different body format.
   - Summarize what changed and why.
   - Include tests or verification performed.
   - Include risks, follow-ups, or skipped checks when relevant.
   - Add a final issue-linking line only when the repository conventions require one.

5. Open the PR.
   - Prefer the repo's existing toolchain: `av` for av-managed stacks, otherwise `gh pr create`.
   - Ask before publishing externally visible changes if the user only asked for a draft or review of PR text.
   - After creation succeeds, report the PR URL and emit the appropriate Codex git directive if the environment requires it.

## Command Shape

For a normal GitHub PR:

```bash
gh pr create --title "<ISSUE-ID>: <imperative PR title>" --body-file <body-file>
```

Use `--draft` when the user asks for a draft PR or when the branch is intentionally not ready for review.

## Checks Before Creating

- The PR title begins with an exact Notion `ID` property value from the Issues database.
- The branch has the commits intended for the PR.
- The target branch is appropriate for the repository.
- Any repository pull request template has been found and followed.
- The body mentions verification, even if the result is "not run".
- The action matches user intent: draft vs ready, create now vs prepare text only.

## Failure Modes

- If Notion is unavailable, do not open a PR unless the user provides the exact issue ID to use.
- If the current branch does not correspond to the issue, ask for confirmation before creating the PR.
- If an existing PR already exists for the branch, update or report it instead of creating a duplicate.
