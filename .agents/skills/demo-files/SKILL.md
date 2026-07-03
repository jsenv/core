---
name: demo-files
description: How to run and verify the `*_demo.html` files scattered across packages (e.g. packages/frontend/navi/src/control/demos/). Use when adding a demo, or when a task calls for actually loading a demo in a browser to check it works (not just reading the JSX).
---

## Overview

Many packages (especially `@jsenv/navi`) ship standalone `*_demo.html` files next to the source they demonstrate, e.g. `packages/frontend/navi/src/control/demos/00_field_demo.html`. These are plain HTML files loaded through jsenv's dev server — no build step, no bundler config to write.

## 1. The dev server

Started with:

```sh
node scripts/dev/dev.mjs
```

It serves the whole repo (`sourceDirectoryUrl` = repo root) on **port 3456**.

**Check before starting one** — it's often already running in the background:

```sh
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3456/ --max-time 2
```

A `200` means it's already up; don't start a second instance (the port is fixed, a second `dev.mjs` will just fail to bind).

## 2. Opening a demo

URLs mirror the repo path directly under the server root:

```
http://127.0.0.1:3456/packages/frontend/navi/src/control/demos/00_field_demo.html
```

No routing/registration needed — any `.html` file under the repo is reachable this way as soon as it exists on disk.

## 3. Verifying with Playwright

`playwright` is a repo-root dependency (see other `*.test.mjs` files under `packages/*/tests/` for the same pattern: `import { chromium } from "playwright"`). To actually drive a demo instead of just reading the code:

```js
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (err) => console.log("PAGEERROR", err));
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("CONSOLE ERROR", msg.text());
});

await page.goto(
  "http://127.0.0.1:3456/packages/frontend/navi/src/control/demos/00_field_demo.html",
  { waitUntil: "networkidle" },
);

await page.locator('input[name="lazy_neighbor_name"]').click();
await page.locator('input[name="lazy_neighbor_name"]').type("hello");
await page.screenshot({ path: "/tmp/demo.png" });

await browser.close();
```

Run it with plain `node` from anywhere inside the repo tree (so `playwright` resolves from the root `node_modules`) — no special flags needed.

## Notes

- Demo files import from the package's source directly (e.g. `@jsenv/navi`), so edits to source are reflected on browser reload — no rebuild step.
- Prefer checking a demo actually renders/behaves correctly over trusting the JSX by inspection alone, especially for anything involving events, focus, or async (Suspense/lazy) — those are exactly the class of bugs these demo files exist to catch.
