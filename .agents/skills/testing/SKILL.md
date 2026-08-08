---
name: testing
description: How to write and run tests in @jsenv/core. Use when adding, running, or understanding tests in any package of this monorepo.
---

## What we want

Tests here exist to **catch regressions** and **document expected behavior** —
never to reach a coverage number. A test captures what actually happens, so a
change that alters behavior is seen and judged, not discovered by a user.

## Running tests

```sh
node --conditions=dev:jsenv <test-file>
```

Run from the repo root (correct Node version, root `node_modules`). The flag is
the repo-wide rule — see
[.agents/instructions.md](../../instructions.md#running-jsenv-source--always-use---conditionsdevjsenv):
without it you test the stale `dist/` bundle instead of your source edits.

## Snapshot testing (primary method)

- Tests generate markdown files containing inputs, outputs, and debug logs.
- Snapshots live in `_test-name.test.js/` directories alongside test files.
- **Snapshot tests do not "fail"** — they pass and update their snapshots
  automatically. The verification IS reading the snapshot diff: expected
  changes are kept, an unexplained one is a regression to fix before moving on.

## Debug logging in tests

- `DEBUG=true` output appears in the snapshot markdown files, not the terminal.
- Use targeted logging to trace complex behaviors; clean it up once resolved.

## Test organization

- Co-locate tests with source code or place them in dedicated `tests/` directories.
- Browser tests use Playwright for real browser behavior.
- Node.js tests cover server-side and CLI functionality.
- Integration tests cover cross-package interactions.
