# Agent Instructions

This repository defines mandatory behavior for coding agents.

## Scope and Priority

1. Follow system/developer instructions from the runtime first.
2. Then follow this file.
3. Then follow task-specific user instructions.

## Non-Negotiable Rules

- Be concise in status and reports.
- Every bugfix requires tests if coverage does not already exist.
- Keep functions short and readable.
- Never mix test code with production code.
- Use i18n keys for all user-facing text and update `lang/*.json`.
- Do not delete debug logs until the user confirms the bug is fixed.
- Do not add comments unless explicitly requested.
- Do not modify code outside the requested scope.
- Do not rename functions unless explicitly requested.
- Do not perform unprompted refactors.
- Keep code clean and readable.
- If uncertain, explicitly say you do not know.
- If an existing unit test fails, do not weaken or rewrite the test to force pass.

## Release Discipline

- If `module.json` version changes, ensure:
  - `CHANGELOG.md` contains a matching version section.
  - A Git tag `v<module.json.version>` exists on GitHub.
- Keep `module.json` release metadata coherent:
  - stable `id` for stable releases
  - `manifest` on `main`
  - `download` on the matching release tag archive
