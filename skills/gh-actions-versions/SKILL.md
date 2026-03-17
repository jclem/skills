---
name: gh-actions-versions
description: Use when editing GitHub Actions workflows or composite actions, especially when adding or changing external `uses:` references under `.github/workflows/` or `.github/actions/`. Install and use the `gh actions-versions` GitHub CLI extension from `jclem/gh-actions-versions`, prefer its fix/update/upgrade commands to hand-editing SHA pins, and ensure `gh actions-versions verify` passes before finishing.
---

# GH Actions Versions

Keep external GitHub Actions references pinned to exact SHAs that match their intended version comments, and use `gh actions-versions verify` as the final gate before finishing workflow changes.

## Workflow

1. Check that the extension is available.
   - Install it with `gh extension install jclem/gh-actions-versions` if needed.
   - Upgrade the extension itself with `gh extension upgrade actions-versions` when you want the latest released binary.
2. Make workflow or composite-action edits.
3. Use the extension instead of hand-editing SHA pins whenever possible.
   - Run `gh actions-versions fix` to pin unpinned actions or repair mismatched SHA and version-comment pairs.
   - Run `gh actions-versions update [owner/repo]` to refresh pins while staying on the current version spec comment, such as `# v5` or `# v2.1`.
   - Run `gh actions-versions update --all` to refresh every referenced action while keeping each existing version spec.
   - Run `gh actions-versions upgrade [owner/repo]` to move one action to its latest release.
   - Run `gh actions-versions upgrade [owner/repo] --version TAG` to move one action to a specific release tag.
   - Run `gh actions-versions upgrade --all` to move every referenced action to its latest release.
4. Run `gh actions-versions verify` from the repository root.
5. Do not finish until `gh actions-versions verify` passes.

## Rules

- Treat `gh actions-versions verify` as required after any change to `.github/workflows/` or `.github/actions/`.
- Prefer `update` when the existing version comment already expresses the desired release stream.
- Prefer `upgrade` when intentionally moving to a newer release stream or exact tag.
- Keep the human-readable version comment after pinned SHAs.
- Mention in the final response whether `gh actions-versions verify` passed.

## Notes

- The extension scans workflows in `.github/workflows/` and composite actions in `.github/actions/`.
- The repository is at `https://github.com/jclem/gh-actions-versions`.
- If the extension is installed from source instead of a released binary, GitHub CLI may build it locally and require `go`.
