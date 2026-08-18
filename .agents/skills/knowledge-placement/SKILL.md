---
name: knowledge-placement
description: Where something you learned or decided about a package must be written down — guideline doc, JSDoc, demo, code comment, or nowhere. Use before writing any .md in a package (especially @jsenv/navi), before adding a doc for a component/export, and when asked whether the documentation is up to date for an AI discovering the package.
---

## What we want

**Knowledge lives where it cannot drift.** The code is the truth about the API;
anything restating it becomes wrong on the next commit and then misleads
whoever trusts it. So the only things worth writing outside the code are the
ones the code cannot say on its own: why a mechanism exists, what it costs,
what must not be hand-written beside it.

The consequence, and it is deliberate: **no reference page per component or per
export.** A page per component is a second API surface to maintain, always one
step behind, and it displaces the habit that actually works — reading the
export and the demo. When a component gains a prop, nothing outside its own
JSDoc should need updating.

An AI arriving on a project that uses a jsenv package is expected to find its
way like this: the package's `docs/AI_INSTRUCTIONS.md` (what exists and what to
read first) → the export's JSDoc → the built bundle in `node_modules/`, which
is the real source with its JSDoc kept → the source tree and its
`*_demo.html`, which live only in the repo (sources are not published — too
big for npm), so a project that wants this to work well keeps a clone of
`jsenv/core` next to it.

## Where a given piece goes

- **A decision, an invariant, a trap** ("who owns focus while a popup is open",
  "never hand-write negative margins to join controls", "what a write sends
  back to the network") → a guideline `docs/*.md` in the package, and a line in
  `docs/AI_INSTRUCTIONS.md`'s list so it is discoverable. One file per _area_,
  never per export.
- **What a prop means, what it accepts** → JSDoc on the export (`@type` +
  `@param`). A hint at the call site, not a manual: no need to repeat what
  flows through to `Box`, nor to re-tell a concept the guideline doc holds.
- **How it is used** → a demo page (see the `demo-files` skill). A demo is the
  example gallery; prose describing usage is the thing it replaces.
- **Why this line is like this** → a code comment, right there (see the comment
  rules in [.agents/instructions.md](../../instructions.md#coding-conventions)).
- **Everything else** → nowhere. Most of what you just learned reading the code
  is retrievable by reading the code again.

## Before adding a `.md`

Ask, in order:

1. Could a JSDoc line carry it? Then it goes there.
2. Could an example carry it? Then it goes in a demo.
3. Is it about one export only? Then it is a reference page — don't write it.
4. What is left — a decision, an invariant, a cost — earns a guideline doc, and
   only that part of it.

And the rule the whole thing rests on: documentation is never written on your
own initiative (see [.agents/instructions.md](../../instructions.md#constraints)).
This skill decides the shape when the user has asked for it.
