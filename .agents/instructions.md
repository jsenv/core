# AI Agent Instructions for @jsenv/core

- [Communication Style](#communication-style)
- [Constraints](#constraints)
- [Writing Skill Files](#writing-skill-files)
- [Project Overview](#project-overview)
- [Running jsenv source](#running-jsenv-source--always-use---conditionsdevjsenv)
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
- **Never write documentation on your initiative** — and when it is asked for, where it goes (guideline doc, JSDoc, demo, code comment, or nowhere) is decided by [.agents/skills/knowledge-placement/SKILL.md](skills/knowledge-placement/SKILL.md)
- **Never verify on your own initiative**: don't run regression checks against unrelated demos/features, and don't open a demo file you just wrote/edited in Playwright or a browser to confirm it works. The user drives verification and will explicitly ask (e.g. "test this in the browser", "run the demo") when they want it. This applies even when a skill (e.g. demo-files) says to prefer checking behavior over reading code — that guidance only kicks in once the user has asked for verification.
- **Keep Playwright for the genuinely tricky cases**: driving a browser with Playwright to inspect/measure/screenshot is heavy and breaks the iterative rhythm, so it is not the default way to check work. Be optimistic about what you just wrote and hand it back. Reach for Playwright when the situation has earned it: the user came back a second time about the same thing, the iteration has been going on for a while and the behavior is subtle (positioning, animation, focus, keyboard), or reading the code genuinely cannot answer the question. A quick measurement then beats another wrong guess — but not on the first pass.
- **Fix the cause, never the symptom**: when something happens twice, arrives in the wrong order, or shows up where it should not, find out WHY before touching anything. A guard that swallows the second occurrence ("already handled, skip"), a flag that remembers what was done, a check for the exact shape of the bad case — those hide the bug instead of removing it, and the next one of the same family lands quietly. Follow it back to the place where two things ask for the same work (two listeners on one event, two owners of one state, a value computed in two places) and make that place right, so there IS no second occurrence to guard against. A defensive guard is acceptable only once the cause is understood and named, and only when the cause genuinely cannot be removed — say so in a comment, next to the guard.
- **Backward Compatibility**: Do not try to maintain it. Breaking changes are fine and desired. Always. So always write code targeting what we want even if that means renaming usages in the codebase.
- **Migration Guides**: Do not proactively document upgrade paths for breaking changes — only on request
- **Don't run the test suite defensively**: only run it (`npm run test`, `npm run test:packages`, etc.) when the task is actually about tests — writing new ones or working on existing ones. The goal of a session is to iterate quickly, not necessarily to reach zero errors; time-consuming verification should happen when it concretely makes sense for the task, not by default. Same spirit as the "never verify on your own initiative" rule above.
- **Never run the whole test suite on your own initiative**: it's long and expensive. Run a single test file, or at most a narrow subset (`npm run test -- ./tests/<some_directory>/`) targeted at what you changed. The full run (`npm run test` with no argument, `npm run test:packages`) only happens when the user explicitly asks for it.
- **Skills own their specifics; this file stays general**: guidance that only applies while doing one kind of task (writing a demo, publishing, updating dependencies, working on the dev server) lives in that skill and must NOT be restated here — this file may point at the skill, nothing more. Conversely a skill points back here for a rule that applies everywhere instead of copying it. When the same rule is found in both places, delete the copy that is in the wrong place; two copies drift, and the reader then can't tell which one is current.
- **Persistent preferences belong in this repo, not in agent-specific memory**: when a durable preference, workflow rule, or constraint is established, write it into `.agents/instructions.md` or a relevant file under `.agents/skills/` and get it committed — don't rely solely on a tool-specific memory/notes system tied to one machine or one agent. This repo is worked on by multiple agents/tools across machines; instructions written here are the ones that actually persist and apply everywhere.
- **Disabling a lint rule is allowed**: a targeted `// eslint-disable-next-line <rule>` with a comment saying why beats contorting the code to please a rule that does not apply to this line. Use it when you know why the rule is wrong here — never to silence something you have not understood.
- **Run prettier/eslint silently**: after editing files, running `prettier --write`/`eslint` to check/fix them is fine and expected, but don't report on it in chat (no "ran prettier, all clean" messages) — it's a mechanical detail the user doesn't want to see.

## Writing Skill Files

A skill teaches how to make decisions in situations that have not happened
yet — it is not a log of one situation that did. Structure every skill
accordingly:

1. **Start with what we want, and why.** The need, the feeling, the invariant —
   stated on its own, before any mechanism. A reader (human or AI) who only
   retains this part should still make the right call in a case the skill never
   mentions.
2. **Then how to obtain it**, as principles that hold across cases.
3. **Examples come last and are labelled as reference** — a file, a function
   name, a demo — to anchor the principle, never to define it.

The failure mode this guards against: a skill written around one particular
fix (its function names, its constants, its exact scenario) reads as "always
do exactly this". The reader copies the mechanics — the 1/5 ratio, the
specific helper — without the concept, and applies them where they don't fit.
Mentioning a particular case is fine; _opening_ with it, or letting it stand
in for the rule, is not. When a rule and its example live at the same level of
detail, the example has taken over — cut it down to a pointer.

## Project Overview

**@jsenv/core** is a comprehensive JavaScript development toolkit that prioritizes web standards and simplicity. Organized as a monorepo with packages in `packages/`:

- `backend/*`: Node.js backend utilities
- `frontend/*`: Frontend libraries and components
- `internal/*`: Internal jsenv-specific packages
- `private/*`: Private projects using jsenv
- `related/*`: Complementary packages to @jsenv/core
- `tooling/*`: Development and build tooling

## Running jsenv source — always use `--conditions=dev:jsenv`

**Any** `node` process that imports a `@jsenv/*` package from this repo (a test, a scratch script, `startDevServer`, `startServer`, a build) MUST be launched with `--conditions=dev:jsenv`:

```sh
node --conditions=dev:jsenv <file>
```

These packages resolve `@jsenv/core` (and siblings like `@jsenv/server`) to their built `dist/` bundle by default; the `dev:jsenv` export condition points imports at `src/` instead. Without the flag you silently run and test the **stale dist bundle**, so your source edits appear to have no effect (routes 404, changes missing, etc.). The repo's own `npm run dev`/`test`/`build` scripts all pass it — match that whenever you run node yourself. The mechanism and dev-server specifics are detailed in [.agents/skills/dev-server/SKILL.md](skills/dev-server/SKILL.md).

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

Demos are used, not read: the work goes into the examples, never into the commentary
around them. Read [.agents/skills/demo-files/SKILL.md](skills/demo-files/SKILL.md)
before writing or editing one — it holds the writing rules, the page structure and
how to run them.

### CSS

- CSS-in-JS using `import.meta.css` for component styles — read the `${}` section
  closing this chapter before writing one
- CSS variables for theming and customization
- `light-dark()` for automatic theme switching
- **Transitions/animations play on change, never on first paint**: a transition or animation must fire when something _changes_ (interaction, state update, value change) — not when the component first mounts, the page loads, or an already-open element re-renders. A user should never see an element animate into its initial state just because the page appeared. Techniques, roughly in order of preference:
  - **`@starting-style`** (standards-first): declare the "from" state in a `@starting-style` block so the browser interpolates from it _only_ on the element's first render / first time it's displayed. Pair with `transition-behavior: allow-discrete` when animating `display`/`overlay` (e.g. popovers/dialogs entering). No JS, no flags — prefer this when the from-state is a fixed style.
  - **The reflow trick** (when `@starting-style` can't express the from-state — e.g. it depends on a real layout box that only exists once shown, as with a positioned popover): set `transition-property: none`, apply the initial ("closed") state, force a layout read (`el.getBoundingClientRect()` / `el.offsetHeight`) so that closed frame is genuinely rendered, then flip to the target state and restore `transition-property`. See `packages/frontend/navi/src/popup/popover.jsx` (search `transitionProperty = "none"` and the `getBoundingClientRect()` reflow) — it also explains in its top comment _why_ `@starting-style` doesn't work there.
  - **Gate on actually-displayed, not merely mounted**: only arm the entrance transition when the element becomes displayed, so it doesn't replay when something already open just re-renders. `useDisplayedLayoutEffect` runs an effect once the element is really on screen; popover.jsx suppresses transitions until it has measured/positioned the element, then arms them.
  - **Simplest of all — no transition at all**: if the emphasis can be positional/compositional (e.g. a fixed overlay the content moves under) rather than a per-element state flip, there's nothing to animate on mount by construction. Prefer this when it fits.
    This applies to color/opacity/transform transitions and keyframe animations alike.
- **Anything that moves over time**: read [.agents/skills/animations/SKILL.md](skills/animations/SKILL.md) — who owns the state while something animates, how an interrupted movement picks up, how it keeps up with a user faster than it, and where view transitions may live.

#### `${}` in `import.meta.css`

**A `${}` costs the whole template, not just the line it sits on.** The build reads
`import.meta.css` by parsing its content as css. A substitution it cannot read makes the
whole template opaque, and everything the css pipeline does is lost for all of it:

- **Comments ship to production**, with every space and newline, in every build.
- **Nothing is transpiled**: no nesting lowering, no prefixing, no fallback for the
  runtimes `runtimeCompat` targets. What is written is what the browser gets.
- **`url("./icon.svg")` is never seen**: the file is not part of the build, not copied,
  not hashed, and the url the browser resolves is relative to the document instead of the
  module. It silently 404s in production.
- **Nothing is checked**: a typo'd property, an unclosed brace, an invalid value — the
  browser finds them, the build does not.
- **Nothing is minified.**

So a `${}` is not a small convenience, it is opting a component's whole stylesheet out of
the build. Write css without one; the ways below cover nearly every reason to reach for it.

##### Instead of a `${}`

**A value the JS knows → a custom property set from JS.** The css stays static, and the
value can change without building a new stylesheet:

```js
// avoid
const setPanelWidth = (width) => {
  import.meta.css = `.panel { width: ${width}; }`;
};

// prefer
import.meta.css = `
  .panel {
    width: var(--panel-width, 300px);
  }
`;
const setPanelWidth = (element, width) => {
  element.style.setProperty("--panel-width", width);
};
```

**A name you did not want to repeat → css nesting.** Reaching into JS for a class or
attribute name to avoid typing a selector twice trades a whole stylesheet for a little
repetition; `&` removes the repetition without leaving css:

```js
// avoid
const ROOT = ".my_button";
import.meta.css = `
  ${ROOT} { color: black; }
  ${ROOT}[data-loading] { opacity: 0.5; }
`;

// prefer
import.meta.css = `
  .my_button {
    color: black;
    &[data-loading] {
      opacity: 0.5;
    }
  }
`;
```

**A variant → a data attribute, both branches written out.** A condition in JS picking a
declaration hides the css; a condition in JS picking an attribute does not:

```js
// avoid
import.meta.css = `.badge { color: ${tone === "danger" ? "red" : "blue"}; }`;

// prefer
import.meta.css = `
  .badge {
    color: blue;
    &[data-tone="danger"] {
      color: red;
    }
  }
`;
element.setAttribute("data-tone", tone);
```

**An asset → a literal `url()`.** Written literally, the build follows it, copies it and
versions it; built in JS it is on its own. When the url truly is dynamic, keep it out of
the template and set it as a custom property, so at least the css around it stays readable.

**A block of declarations repeated in several rules → a selector list.** A css fragment
held in a JS constant and interpolated into three rules is three blind stylesheets; the
same declarations under one selector list are css.

**A whole stylesheet shared between modules → a module exposing an install function.**
The build reads `import.meta.css = name` only when `name` is declared in the same module,
so a shared sheet cannot be pulled in as an imported constant. Give it a module of its
own — and call the install function from a render rather than assigning at module scope,
so the sheet stays droppable:

```js
// avoid — every consumer carries its own copy of the shared css, and none is readable
import.meta.css = sharedCss + css;

// shared_css.js
const sharedCss = /* css */ `
  .shared {
    color: var(--ink);
  }
`;
export const installSharedCss = () => {
  import.meta.css = sharedCss;
};

// consumer.jsx
export const Consumer = (props) => {
  installSharedCss();
  import.meta.css = css;
};
```

Two things follow from the setter being keyed by module. **Two assignments in one module
do not add up** — the second replaces the first, so a module has one stylesheet and a
shared sheet needs a module of its own. And the sheet is adopted **when the assignment
runs**: from a render, a page that never renders the component never carries it and a
bundler that sees no caller drops the css with the code; at module scope, it lands on
every page importing the module and nothing can shake it out. Assign at module scope only
for a module that is a side effect by design — an app's tokens, say.

##### The one substitution the build can read

A substitution standing exactly **where a css value stands** does not blind the build: it
is swapped for `var(--jsenv-css-substitution-N)`, the css is parsed and transformed as
usual, and the expression takes the placeholder's place back afterwards.

```js
import.meta.css = /* css */ `
  /* stripped, like any comment */
  .panel {
    padding: ${gap} 4px;
    color: ${color};
  }
`;
// built: `.panel{padding:${gap} 4px;color:${color}}`
```

It holds only when **all** of these are true — the expression is inside a rule block,
after the `:` of a declaration, and not inside a string, inside `url()`, in an at-rule
prelude, in a selector or in a property name — and the placeholder must come out of the
css transformation exactly once (a prefixed duplicate makes it twice).

When any of it fails the template ships verbatim, with every consequence listed above, and
**nothing is logged**. So this is a safety net for value substitutions, not a licence to
interpolate: a custom property is still the better answer, it keeps the css static _and_
lets the value change without rebuilding a stylesheet.

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
