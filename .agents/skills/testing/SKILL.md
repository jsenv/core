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

## Service worker lifecycle

A test or a measurement of when a worker stops, activates or fails to update
must see what a real browser does. Three things in the usual harness change it
without a warning:

- **Playwright attaches DevTools to every service worker**, and Chromium never
  stops an idle worker with DevTools attached. Anything that waits on a worker
  stopping (activation after `skipWaiting()`, the 30 s idle stop) then never
  happens. Launch Chromium by hand (`chromium.executablePath()` with
  `--headless=new --remote-debugging-port=<port> --user-data-dir=<tmp>`) and
  speak raw CDP to the page target listed by `/json/list`:
  `ServiceWorker.enable` reads worker states without attaching to them,
  `ServiceWorker.stopAllWorkers` puts every worker in a known state.
- **`context.setOffline()` and `page.route()` don't reach the worker script's
  update request.** A failing update is produced by the server: a 404 mode, a
  closed socket, a script that throws.
- **A simulated deploy changes `resources` or `version`.** The cache name of
  `@jsenv/service-worker` is hashed from them, not from `meta` nor the worker
  code: a deploy changing only those installs into the cache the active worker
  serves from.

Desktop Chromium runs the same lifecycle as Chrome Android; a phone (raw CDP
through `adb forward tcp:9222 localabstract:chrome_devtools_remote`, dropped
when the screen sleeps) is for what is Android-specific.
