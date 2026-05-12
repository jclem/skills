---
name: gh-actions-versions
description: Use when reading, editing, reviewing, or maintaining GitHub Actions workflows or composite actions. Always use the `gh actions-versions` GitHub CLI extension from `https://github.com/jclem/gh-actions-versions` to keep external action references pinned to exact SHAs, verify that pins match their version comments, periodically check whether workflow actions are on the latest available versions, and suggest updates when they are stale.
---

# GH Actions Versions

Use `gh actions-versions` to keep GitHub Actions dependencies secure, pinned, and fresh. Do not hand-maintain action SHAs when the extension can do it.

Repository: `https://github.com/jclem/gh-actions-versions`

## Install

Before working with workflows, check whether the extension is installed:

```sh
gh extension list
```

If it is missing, install it:

```sh
gh extension install jclem/gh-actions-versions
```

To update the extension itself:

```sh
gh extension upgrade actions-versions
```

If installing from source, GitHub CLI may build locally and require `go`.

## Workflow

1. Inspect the repository's GitHub Actions files under `.github/workflows/` and composite actions under `.github/actions/`.
2. Use `gh actions-versions verify` before and after relevant workflow edits.
3. Use the extension instead of editing action SHAs by hand:
   - `gh actions-versions fix` pins unpinned actions and repairs SHA/comment drift.
   - `gh actions-versions update [owner/repo]` refreshes pins while keeping the current version comment, such as `# v5` or `# v2.1`.
   - `gh actions-versions update --all` refreshes all pins while keeping existing version comments.
   - `gh actions-versions upgrade [owner/repo]` moves one action to its latest release.
   - `gh actions-versions upgrade [owner/repo] --version TAG` moves one action to a specific release tag.
   - `gh actions-versions upgrade --all` moves every referenced action to its latest release.
4. Run `gh actions-versions verify` from the repository root before finishing.
5. Mention in the final response whether verification passed.

## Pinning Rules

- External `uses:` references must be pinned to exact SHAs.
- Keep the human-readable version comment after pinned SHAs.
- Treat a failed `verify` result as a required fix unless the user explicitly asks only for an audit.
- Prefer `fix` when refs are unpinned or SHA/comment pairs drifted.
- Prefer `update` when the existing version comment is still the desired release stream.
- Prefer `upgrade` when intentionally moving to the latest release stream or a specific newer tag.

## Freshness Checks

Periodically check whether actions are behind their latest available versions whenever workflow maintenance is in scope, especially when:

- Editing `.github/workflows/` or `.github/actions/`.
- Reviewing workflow changes.
- Debugging CI behavior that may be caused by stale actions.
- The user asks about dependency freshness, security, maintenance, or updates.

Use `gh actions-versions upgrade --all` to discover available latest-release upgrades. If upgrades are available but the user did not explicitly ask to apply them, summarize the stale actions and suggest updating. Do not silently broaden a narrow workflow change into unrelated version upgrades.
