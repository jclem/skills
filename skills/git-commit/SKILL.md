---
name: git-commit
description: Write or review Git commit messages using a strict house style. Use when drafting commit messages, creating commits, reviewing proposed commit text, or explaining the preferred commit-message format.
---

# Git Commit

Use this skill to draft or review Git commit messages.

## Subject Line

Write the first line as a single imperative sentence with no final punctuation.

Good:

```txt
Add architecture documentation
```

```txt
Insert new account rows in a transaction
```

```txt
Fix timing bug when checking password
```

Bad:

```txt
Add architecture documentation.
```

```txt
Inserts new account rows in a transaction
```

```txt
api: Add user authentication
```

```txt
fix: Fix timing bug when checking password
```

Rules:

- Use imperative mood.
- Do not end the first line with punctuation.
- Do not prefix the subject with a type, scope, package, area, or conventional-commit label.
- Keep the subject as one sentence.
- Prefer a specific verb that describes the change being made.

## Body

If more context is required, add one blank line after the subject, then write freeform content in one or more paragraphs.

Use the body to explain why the change was made, what tradeoffs matter, or what future readers need to know. Do not use the body when the subject line is enough.

Example:

```txt
Add architecture documentation

Record the initial technology choices for Envelope so future scaffolding work has a concrete direction. The document captures the Cloudflare-first deployment model, Effect backend shape, D1/SQLite portability, and frontend library choices.
```
