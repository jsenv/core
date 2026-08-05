---
name: demo-files
description: How to write, run and verify the `*_demo.html` files scattered across packages (e.g. packages/frontend/navi/src/control/demos/). Use when writing a demo, or when the user explicitly asks to load one in a browser / Playwright to check it works — the latter not proactively (see .agents/instructions.md's "never verify on your own initiative" constraint).
---

## Writing a demo: show, don't explain

A demo is something the reader _uses_. The effort goes into the examples, never into
the commentary around them. See
[.agents/instructions.md](../../instructions.md#demo-files) for the rule; concretely:

- **Default to no prose.** Each example gets a short `<Label>`/`<legend>`/caption
  naming the case and the prop that drives it (`minWidth="140"`, `maxLines=3`,
  `popupWidthFitContent`) — that is usually the entire explanation needed.
- **A section intro is one short sentence, or nothing**, in the reader's terms
  ("As big as its largest slide, in both directions"). Never a paragraph, never a
  description of how it works.
- **No implementation talk.** A demo never mentions the CSS properties, the
  internal mechanics or the tricks that make it work (`overflow: hidden`, a
  translated track, a grid cell, a layout effect). That is what code comments next
  to the code are for. Prose that only makes sense to someone reading the source
  is the mistake to catch.
- **Repeat the case instead of stating the rule.** Successive examples that build
  on each other (1 line → 3 → 6, then two slides, then two slides one wider) let
  the reader induce it; a sentence claiming it does not.
- **Make the difference visible, then say nothing**: default next to opted-out,
  loading next to loaded — plus whatever border, background or control it takes to
  actually _see_ it. That work replaces the paragraph.
- **One example per row, each clearly separated** (a column with spacing, its own
  caption) so every case can be tried on its own; examples crammed side by side
  read as a single picture.
- Write a paragraph only for what the example genuinely cannot show: an invariant,
  a browser constraint, a rejected approach, a "this looks wrong but isn't".
- Never narrate what the reader is about to see ("press Load to watch it swap"),
  restate a prop's semantics that the label already carries, or explain machinery
  the demo doesn't exercise.
- Interactive behaviour (focus, hover, drag, keys) is shown by something that
  reacts, never described. Reading a paragraph costs as much as trying it.

Before leaving a paragraph in a demo: could an example replace it? does it say
_how_ rather than _what_? Either way — delete it, build the example.

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
- When the user does ask for verification, prefer checking a demo actually renders/behaves correctly over trusting the JSX by inspection alone, especially for anything involving events, focus, or async (Suspense/lazy) — those are exactly the class of bugs these demo files exist to catch.
- Do NOT run this on your own initiative — not for a demo you just wrote, not as a "regression check" against unrelated existing demos after touching shared code (e.g. Popover/Dialog). The user drives when verification happens; wait for an explicit ask.
