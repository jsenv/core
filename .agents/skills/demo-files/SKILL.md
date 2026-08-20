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

## What a demo page is made of

Shared furniture lives next to the source, not copy-pasted into each demo:

- **`src/internal/demo_header.jsx`** — `<DemoHeader>`: the title strip and the way
  back to the directory listing. Every demo starts with it.
- **`src/internal/document_toc.jsx`** — `<DocumentToc>`: the table of contents,
  read off the headings that come after it (so it is always right). Put it in a
  first section; give every heading an id and an anchor link.
- **`src/internal/fake_backend.jsx`** — `<FakeBackend value={…}>{({ value, action }) => …}</FakeBackend>`:
  a backend on the page. Three bands — what the backend holds, the frontier where a
  call in flight is drawn, and the frontend below. The call waits until a human
  presses "répondre" or "échouer", which is what makes the loading state, the error
  callout and "nothing to send" watchable rather than a flicker. Use it for
  anything asynchronous: an action, a form, an optimistic update.
  - A page with **several endpoints** (a REST resource, an api module) makes its
    backend outside the tree with `createFakeBackend()` and names each call —
    `backend.call("GET /games/1", () => …)`, which throws to say no — then draws
    it with `<FakeBackend backend={backend}>`. The frontier then holds one line
    per call in flight.
  - `persist="a_storage_key"` keeps what the backend holds across reloads, and
    adds a "repartir de zéro" button next to the mode — for a demo one comes
    back to, where putting the data back would be the first minute of every
    visit.
  - The **mode** picker (top right) answers for you — 50 ms, 500 ms, 2 s, or
    always fail — and is remembered across reloads, for a page that exercises
    something else and only needs the backend to behave. "manuel" stays the
    default.
- **`src/control/demos/utils/call_log.jsx`** — `useCallLog()` + `<CallLog>`: what
  was called with what, and from which event. Use it for `uiAction`/`action`
  rather than a paragraph describing when they fire.

The first three sections are always the same three, in this order — a reader
opening any component's demo finds the same beginning:

1. **`<DemoHeader>` + the table of contents** — a section holding
   `<DocumentToc>`, and, when the page binds signals to the url, a "reset all"
   button beside it (set them to `undefined`, which is what empties the url).
2. **Cas nominal** — the component with nothing on it, doing the thing it is
   for. Whatever the page goes on to show, this is what it looks like in normal
   use.
3. **États** — read-only, disabled, loading, focus visible, side by side. The
   ones that cannot be obtained by sitting there (a focus ring) are HELD with
   `pseudoState={{ ":focus-visible": true }}` so they are on the page like the
   others rather than a Tab press away.

Then the rest, in this shape:

4. One section per concern, and never two concerns in one section — a section
   showing sizes shows nothing else; the one showing styles changes nothing else.
   Sub-headings (h3) for the variations inside it.
5. The props that bound or drive the thing (`min`, `max`, `step`, `uiAction`)
   last, one section each: `min` alone, then `max` alone, so each is seen doing
   its own thing (a `min` set to today makes the left way out unavailable at once).

And within a section:

- **The caption comes before the example**: one reads what is being shown, then
  looks at it.
- **Show the default next to the variant**, and change one prop between them.
  Everything else identical — same width, same content — or the comparison is
  about the wrong thing.
- **Fix what would otherwise move.** A control whose width follows its content
  makes every example a different size; give the compared examples a `width` and
  say so once in the section.
- **Drive it with props, not with a class name**: `borderWidth="1"`,
  `width="300px"`, `paddingY="m"` — a demo is also where the API is read. Reach
  for a stylesheet only for the page's own furniture.
- **States are part of the demo**: `readOnly`, `disabled`, `loading` side by side
  say more than any sentence about them.

## Running a demo

Many packages (especially `@jsenv/navi`) ship standalone `*_demo.html` files next to the source they demonstrate, e.g. `packages/frontend/navi/src/control/demos/00_field_demo.html`. These are plain HTML files loaded through jsenv's dev server — no build step, no bundler config to write. And since they import the package's source directly (e.g. `@jsenv/navi`), edits to source are reflected on browser reload.

### The dev server

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

### Opening one

URLs mirror the repo path directly under the server root:

```
http://127.0.0.1:3456/packages/frontend/navi/src/control/demos/00_field_demo.html
```

No routing/registration needed — any `.html` file under the repo is reachable this way as soon as it exists on disk.

## Verifying with Playwright

Only when the user asks — the "never verify on your own initiative" constraint
in [.agents/instructions.md](../../instructions.md#constraints) applies to a
demo just written AND to regression checks against unrelated demos after
touching shared code. When they do ask, prefer driving the demo over trusting
the JSX by inspection, especially for events, focus, or async (Suspense/lazy)
— exactly the class of bugs these files exist to catch.

`playwright` is a repo-root dependency (see other `*.test.mjs` files under `packages/*/tests/` for the same pattern: `import { chromium } from "playwright"`):

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
