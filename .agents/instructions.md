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

- **Never write tests on your initiative**
- **Never write documentation on your initiative**
- **Never verify on your own initiative**: don't run regression checks against unrelated demos/features, and don't open a demo file you just wrote/edited in Playwright or a browser to confirm it works. The user drives verification and will explicitly ask (e.g. "test this in the browser", "run the demo") when they want it. This applies even when a skill (e.g. demo-files) says to prefer checking behavior over reading code — that guidance only kicks in once the user has asked for verification.
- **Backward Compatibility**: Do not try to maintain it. Breaking changes are fine and desired. Always. So always write code targeting what we want even if that means renaming usages in the codebase.
- **Migration Guides**: Do not proactively document upgrade paths for breaking changes — only on request
- **Don't run the test suite defensively**: only run it (`npm run test`, `npm run test:packages`, etc.) when the task is actually about tests — writing new ones or working on existing ones. The goal of a session is to iterate quickly, not necessarily to reach zero errors; time-consuming verification should happen when it concretely makes sense for the task, not by default. Same spirit as the "never verify on your own initiative" rule above.
- **Persistent preferences belong in this repo, not in agent-specific memory**: when a durable preference, workflow rule, or constraint is established, write it into `.agents/instructions.md` or a relevant file under `.agents/skills/` and get it committed — don't rely solely on a tool-specific memory/notes system tied to one machine or one agent. This repo is worked on by multiple agents/tools across machines; instructions written here are the ones that actually persist and apply everywhere.
- **Run prettier/eslint silently**: after editing files, running `prettier --write`/`eslint` to check/fix them is fine and expected, but don't report on it in chat (no "ran prettier, all clean" messages) — it's a mechanical detail the user doesn't want to see.

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
- To add debug logs: use `console.debug` with plain sentences, not objects (easier to copy-paste)
- **Optional Chaining**: Only use `?.` when the value can genuinely be undefined. If you control the data structure and know values exist, access them directly
- **Always use `{}` block bodies**: Never single-expression `if` without braces. Always `if (x) { return y; }` not `if (x) return y;` — makes it easy to add `console.log` or `debugger` without restructuring
- **No history-referencing comments**: Never write comments explaining what used to be there, what changed, or that something "no longer" happens (e.g. "no more X round-trip", "replaces the old Y", "instead of a hook-based one"). Comments describe the current code, not its diff against a previous version — that belongs in the commit message/PR description. A comment should make sense to someone who has never seen the old code.

#### JSDoc

- Use `@type {import("preact").FunctionComponent<{ ... }>}` on exported components so VSCode can autocomplete prop types
- For non-obvious props, add `@param` entries after the `@type` block to provide textual descriptions — VSCode shows both in the hover tooltip
- See `packages/frontend/navi/src/control/list/list.jsx` for a `@type`-only reference example
- See `packages/frontend/navi/src/text/text.jsx` for a combined `@type` + `@param` example

### CSS

- CSS-in-JS using `import.meta.css` for component styles
- CSS variables for theming and customization
- `light-dark()` for automatic theme switching

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
