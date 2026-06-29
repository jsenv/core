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
- **Backward Compatibility**: Do not try to maintain it. Breaking changes are fine and desired. Always. So always write code targeting what we want even if that means renaming usages in the codebase.
- **Migration Guides**: Do not proactively document upgrade paths for breaking changes — only on request

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

#### JSDoc

- Use `@type {import("preact").FunctionComponent<{ ... }>}` on exported components so VSCode can autocomplete prop types
- See `packages/frontend/navi/src/control/list/list.jsx` for a reference example

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
