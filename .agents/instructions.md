# AI Agent Instructions for @jsenv/core

- [Communication Style](#communication-style)
- [Constraints](#constraints)
- [Project Overview](#project-overview)
- [Key Architectural Principles](#key-architectural-principles)
- [File Naming](#file-naming)
- [Coding Conventions](#coding-conventions)
- [@jsenv/navi Specifics](#jsenvnavi-specifics)

## Communication Style

- **Concise Updates**: Brief status updates, single-sentence explanations when helpful
- **Code-First**: Lead with implementation, provide short context when beneficial
- **Minimal Ceremony**: Skip unnecessary scaffolding like extensive test suites during initial development
- **Action-Oriented**: Show progress through working code rather than lengthy discussions
- **Defer Documentation**: Tests and comprehensive documentation come later in the development cycle

## Constraints

- **Never commit — the user always commits**: do NOT run `git commit` (or `git push`), ever, even to "prepare a release" or save work in progress. Make the file edits and leave them in the working tree; the user reviews and commits every change themselves. This holds even when a workflow (e.g. the publish skill) lists a commit step — stop before it and hand off. Likewise never publish (`npm run monorepo:publish`) unless explicitly asked in the moment.
- **Never write tests on your initiative**
- **Never write documentation on your initiative**
- **Never verify on your own initiative**: don't run regression checks against unrelated demos/features, and don't open a demo file you just wrote/edited in Playwright or a browser to confirm it works. The user drives verification and will explicitly ask (e.g. "test this in the browser", "run the demo") when they want it. This applies even when a skill (e.g. demo-files) says to prefer checking behavior over reading code — that guidance only kicks in once the user has asked for verification.
- **Backward Compatibility**: Do not try to maintain it. Breaking changes are fine and desired. Always. So always write code targeting what we want even if that means renaming usages in the codebase.
- **Migration Guides**: Do not proactively document upgrade paths for breaking changes — only on request
- **Don't run the test suite defensively**: only run it (`npm run test`, `npm run test:packages`, etc.) when the task is actually about tests — writing new ones or working on existing ones. The goal of a session is to iterate quickly, not necessarily to reach zero errors; time-consuming verification should happen when it concretely makes sense for the task, not by default. Same spirit as the "never verify on your own initiative" rule above.
- **Never run the whole test suite on your own initiative**: it's long and expensive. Run a single test file, or at most a narrow subset (`npm run test -- ./tests/<some_directory>/`) targeted at what you changed. The full run (`npm run test` with no argument, `npm run test:packages`) only happens when the user explicitly asks for it.
- **Persistent preferences belong in this repo, not in agent-specific memory**: when a durable preference, workflow rule, or constraint is established, write it into `.agents/instructions.md` or a relevant file under `.agents/skills/` and get it committed — don't rely solely on a tool-specific memory/notes system tied to one machine or one agent. This repo is worked on by multiple agents/tools across machines; instructions written here are the ones that actually persist and apply everywhere.
- **Run prettier/eslint silently**: after editing files, running `prettier --write`/`eslint` to check/fix them is fine and expected, but don't report on it in chat (no "ran prettier, all clean" messages) — it's a mechanical detail the user doesn't want to see.

## Running jsenv source — always use `--conditions=dev:jsenv`

**Any** `node` process that imports a `@jsenv/*` package from this repo (a test, a scratch script, `startDevServer`, `startServer`, a build) MUST be launched with `--conditions=dev:jsenv`:

```sh
node --conditions=dev:jsenv <file>
```

These packages resolve `@jsenv/core` (and siblings like `@jsenv/server`) to their built `dist/` bundle by default; the `dev:jsenv` export condition points imports at `src/` instead. Without the flag you silently run and test the **stale dist bundle**, so your source edits appear to have no effect (routes 404, changes missing, etc.). The repo's own `npm run dev`/`test`/`build` scripts all pass it — match that whenever you run node yourself. The mechanism and dev-server specifics are detailed in [.agents/skills/dev-server/SKILL.md](skills/dev-server/SKILL.md).

## Project Overview

**@jsenv/core** is a comprehensive JavaScript development toolkit that prioritizes web standards and simplicity. Organized as a monorepo with packages in `packages/`:

- `backend/*`: Node.js backend utilities
- `frontend/*`: Frontend libraries and components
- `internal/*`: Internal jsenv-specific packages
- `private/*`: Private projects using jsenv
- `related/*`: Complementary packages to @jsenv/core
- `tooling/*`: Development and build tooling

## Key Architectural Principles

- **Standards-First**: Built on web standards, native ES modules, modern JavaScript, CSS variables
- **Plugin-Based**: Plugin patterns for dev server and build system extensibility
- **Signal-Based State**: Uses `@preact/signals` for reactive state across frontend packages

## File Naming

- `snake_case` for directories and files
- `camelCase` for JavaScript variables and functions
- `.mjs` for scripts, `.jsx` for components, `.js` for modules

## Coding Conventions

### JavaScript / JSX

- Always use ES module syntax
- Prefer async/await over Promise chains
- Use Preact JSX pragma for frontend components
- Prefer named things: named params, named exports over default exports
- Put helper functions at the bottom of the file
- Put constants / simple variables above the function that uses them (for exported functions: top of file after imports; for helpers: just above them)
- Never use `Math.max` / `Math.min` — prefer explicit branching, it's easier to follow
- **Explicit browser globals**: reach ambiguous browser globals through `window.` — `window.crypto`, `window.navigator`, `window.location`, `window.history`, `window.open`, `window.close`, `window.scroll`, `window.status`, `window.name`, `window.length`, etc. Never the bare form. Enforced by eslint (`explicitGlobals` in `@jsenv/eslint-config-relax` turns these off), and the point is to keep a global read visually distinct from a local binding of the same name — `window.open(...)` vs a local `open` variable, `window.name` vs a local `name`. Non-ambiguous browser APIs (`document`, `localStorage`, `fetch`, `setTimeout`, `console`, …) stay bare.
- To add debug logs: use `console.debug` with plain sentences, not objects (easier to copy-paste)
- **Optional Chaining**: Only use `?.` when the value can genuinely be undefined. If you control the data structure and know values exist, access them directly
- **Always use `{}` block bodies**: Never single-expression `if` without braces. Always `if (x) { return y; }` not `if (x) return y;` — makes it easy to add `console.log` or `debugger` without restructuring
- **No history-referencing comments**: Never write comments explaining what used to be there, what changed, or why the current code is better/different than before. Comments describe the current code in isolation, as if written by someone seeing it for the first time — not its diff against a previous version. That belongs in the commit message/PR description.
  - Banned words/phrases (all signal a diff-comment, not a code-comment): "now" (as in "X now does Y"), "no longer", "instead of", "used to", "previously", "replaces", "changed from", "no more X", "own top-layer element now", "not a descendant of X anymore".
  - Bad: `// The backdrop is its own top-layer element now` — implies there's an "old way" the reader needs to unlearn.
  - Good: `// A sibling top-layer element, not a descendant of the popover — see the CSS comment for why.` — describes the structure as it is, no before/after.
  - Bad: `// No more positionX/positionY props — anchorArea covers this now.`
  - Good: nothing, or if the constraint is non-obvious, state it as a fact about the current API: `// anchorArea covers both axes in one prop.`
  - This applies even when the comment is otherwise useful/accurate — rewrite it to drop the comparison rather than skip explaining a genuinely non-obvious constraint.
- **Don't comment what the code already says**: if a comment just narrates control flow or restates what a well-named variable/function already makes obvious ("Sync the DOM open and return how to sync it back closed" above a function that visibly does exactly that), delete it. Only comment the _why_ behind a non-obvious choice — a constraint, a workaround, a rejected simpler alternative, a subtle invariant. If you can delete a comment and lose nothing a fresh reader needs, delete it.
- **Long documentation doesn't belong inline next to implementation**: a prop's accepted-values grammar, a parameter's semantics, "how to use this component" — that's JSDoc (`@param` on the exported function/component, per the JSDoc section below) or a short module-level comment near the top of the file, not a multi-paragraph comment sitting next to the line of code that happens to use it. Inline comments justify _that specific line_; they are not the place to teach the whole feature.
- **Keep inline comments short**: a sentence or two justifying the non-obvious choice at that line. If an inline comment runs past ~4-5 lines, either it belongs in a JSDoc/module-level comment instead (see above), or it needs to be cut down to its one essential point — don't preserve every nuance "just in case", trim to what a reader actually needs to not get confused at that line.

#### JSDoc

- Use `@type {import("preact").FunctionComponent<{ ... }>}` on exported components so VSCode can autocomplete prop types
- For non-obvious props, add `@param` entries after the `@type` block to provide textual descriptions — VSCode shows both in the hover tooltip
- See `packages/frontend/navi/src/control/list/list.jsx` for a `@type`-only reference example
- See `packages/frontend/navi/src/text/text.jsx` for a combined `@type` + `@param` example

#### Top-level file comments

A file's own top-of-file comment has exactly two jobs:

1. **Orient a first-time reader**: give whoever just opened this file (a newcomer, the author back after a few days away, an AI with no memory of the conversation that wrote it) a quick overall picture of what the file does and how it's organized.
2. **Justify surprising technical choices**: explain _why_ a non-obvious decision was made, and warn about approaches that were tried and specifically must not be reintroduced.

Nothing else belongs there. Other sources already cover everything else — the top-level comment must not restate what they say: the code itself (well-named functions/variables), inline comments (the _why_ at one specific line), JSDoc (a prop's accepted values/semantics), external docs, demo files. If a paragraph in a top-level comment is really documenting a prop's grammar or "how to use this component," move it to JSDoc instead — don't duplicate it in both places. Before adding a paragraph to a top-level comment, ask: is this orientation, or a warning about a rejected approach? If neither, it belongs somewhere else (or nowhere).

#### Demo files

Demos are used, not read. A well-chosen example, cut into steps and carrying a short label, is worth a thousand words — so write the examples, not the commentary around them.

- Default to **no prose**. A `<Label>`/`<legend>` naming the case and the prop that drives it (`minWidth="140"`, `maxLines=3`, `popupWidthFitContent`) is normally the whole explanation.
- When a difference needs making clear, add the **contrasting example** rather than a sentence about it: default beside opted-out, loading beside loaded.
- Keep a paragraph only for what the example genuinely cannot show: a non-obvious invariant, a browser constraint, an approach that must not be reintroduced.
- Never narrate what the reader is about to see, restate what a label already says, or describe machinery the demo doesn't exercise.

See [.agents/skills/demo-files/SKILL.md](skills/demo-files/SKILL.md) for running them.

### CSS

- CSS-in-JS using `import.meta.css` for component styles
- CSS variables for theming and customization
- `light-dark()` for automatic theme switching
- **Transitions/animations play on change, never on first paint**: a transition or animation must fire when something _changes_ (interaction, state update, value change) — not when the component first mounts, the page loads, or an already-open element re-renders. A user should never see an element animate into its initial state just because the page appeared. Techniques, roughly in order of preference:
  - **`@starting-style`** (standards-first): declare the "from" state in a `@starting-style` block so the browser interpolates from it _only_ on the element's first render / first time it's displayed. Pair with `transition-behavior: allow-discrete` when animating `display`/`overlay` (e.g. popovers/dialogs entering). No JS, no flags — prefer this when the from-state is a fixed style.
  - **The reflow trick** (when `@starting-style` can't express the from-state — e.g. it depends on a real layout box that only exists once shown, as with a positioned popover): set `transition-property: none`, apply the initial ("closed") state, force a layout read (`el.getBoundingClientRect()` / `el.offsetHeight`) so that closed frame is genuinely rendered, then flip to the target state and restore `transition-property`. See `packages/frontend/navi/src/popup/popover.jsx` (search `transitionProperty = "none"` and the `getBoundingClientRect()` reflow) — it also explains in its top comment _why_ `@starting-style` doesn't work there.
  - **Gate on actually-displayed, not merely mounted**: only arm the entrance transition when the element becomes displayed, so it doesn't replay when something already open just re-renders. `useDisplayedLayoutEffect` runs an effect once the element is really on screen; popover.jsx suppresses transitions until it has measured/positioned the element, then arms them.
  - **Simplest of all — no transition at all**: if the emphasis can be positional/compositional (e.g. a fixed overlay the content moves under) rather than a per-element state flip, there's nothing to animate on mount by construction. Prefer this when it fits.
    This applies to color/opacity/transform transitions and keyframe animations alike.

## @jsenv/navi Specifics

### Actions System

```js
const getUserAction = createAction(async ({ userId }) => {
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
});

const getUserWithIdAction = getUserAction.bindParams({ userId: 123 });

const userProxy = createActionProxy(getUserAction, {
  userId: userIdSignal, // Reactive
  includeProfile: true, // Static
});
```

Key features: automatic memoization, request deduplication, concurrent loading control, progressive loading.
