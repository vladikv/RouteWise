---
name: commit
description: Prepares a Conventional Commit for staged changes in RouteWise. Use when the user asks to commit.
---

# Commit

1. Run `git status` and `git diff --staged`. If nothing is staged,
   propose which files to stage, grouped by logical change.
2. If the diff contains more than one logical change, propose splitting it.
3. Write the message:
  - Format: `<type>(<scope>): <summary>`
  - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`
  - Scopes: `api`, `ui`, `ai`, `db`, `docs`, `ci`, `tooling`
  - Summary: imperative mood, lowercase, no period, max 72 chars
  - Body (optional): explain *why*, wrapped at 72 chars
4. Show the message and wait for confirmation before committing.
5. Never commit secrets, `.env` files or build output.
