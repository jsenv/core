---
name: testing
description: How to write and run tests in @jsenv/core. Use when adding, running, or understanding tests in any package of this monorepo.
---

## Overview

Testing in @jsenv/core focuses on **behavior verification** and **regression prevention** rather than exhaustive coverage. Tests capture actual behavior to ensure changes don't break existing functionality.

## Running Tests

Run tests from the repo root to ensure the correct Node.js version (26.5.0):

```sh
node --conditions=dev:jsenv <test-file>
```

The `dev:jsenv` export condition uses source files directly — no build step needed. For packages like `@jsenv/server`, this avoids rebuilding `dist/` after every source change.

## Snapshot Testing (Primary Method)

- Tests generate markdown files containing inputs, outputs, and debug logs
- Snapshots live in `_test-name.test.js/` directories alongside test files
- **Important**: Snapshot tests do not "fail" in the traditional sense — they always pass and update snapshots automatically. You must manually read and verify snapshot files to ensure results haven't changed unexpectedly
- Review snapshot diffs to verify intended behavior changes

## Debug Logging in Tests

- `DEBUG=true` output appears in snapshot markdown files, not the terminal
- Use targeted logging to trace complex behaviors during development
- Clean up debug logs once issues are resolved

## Test Organization

- Co-locate tests with source code or place in dedicated `tests/` directories
- Browser tests use Playwright for real browser behavior
- Node.js tests for server-side and CLI functionality
- Integration tests for cross-package interactions

## Goal

Write tests that **catch regressions** and **document expected behavior**, not to achieve high coverage metrics.
