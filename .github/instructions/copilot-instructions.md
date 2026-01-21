---
applyTo: "**"
---

# AI Coding Agent Instructions for @jsenv/core

## Development Workflow and Communication Style

### Iteration Velocity

- **Efficiency First**: Focus on functional code implementation rather than verbose explanations
- **Direct Implementation**: Get to working code quickly, minimize analysis paralysis
- **Defer Documentation**: Tests and comprehensive documentation come later in the development cycle
- **Action-Oriented**: Show progress through working code rather than lengthy discussions

### Communication Preferences

- **Concise Updates**: Brief status updates with single-sentence explanations when helpful
- **Code-First**: Lead with implementation, provide short context when beneficial
- **Problem-Solution Focus**: Identify issue → implement fix → verify it works
- **Balanced Communication**: Avoid both excessive verbosity and complete silence - a brief explanation enhances understanding
- **Minimal Ceremony**: Skip unnecessary scaffolding like extensive test suites during initial development

This approach prioritizes rapid iteration and maintains development momentum while ensuring quality through focused implementation.

### Testing Strategy

Testing in @jsenv/core focuses on **behavior verification** and **regression prevention** rather than exhaustive coverage. Tests capture the actual behavior of code to ensure changes don't break existing functionality.

- **Snapshot Testing**: Primary method for capturing complex outputs, side effects, and multi-step behaviors
  - Tests generate markdown files containing inputs, outputs, and debug logs
  - Snapshots live in `_test-name.test.js/` directories alongside test files
  - Review snapshot diffs to verify intended behavior changes
  - **Important**: Snapshot tests do not "fail" in the traditional sense - they always pass and update snapshots automatically. You must manually read and verify snapshot files to ensure results still make sense and haven't changed unexpectedly
- **Behavioral Testing**: Focus on testing what the code actually does, not implementation details
  - Test user-facing behavior and API contracts
  - Capture edge cases and error scenarios
  - Verify integration points between components

- **Debug Logging in Tests**:
  - `DEBUG=true` output appears in snapshot markdown files, not terminal
  - Use targeted logging to trace complex behaviors during development
  - Clean up debug logs once issues are resolved
  - Run tests from project root to ensure correct Node.js version (25.1.0)

- **Test Organization**:
  - Co-locate tests with source code or place in dedicated `tests/` directories
  - Browser tests use Playwright for real browser behavior
  - Node.js tests for server-side and CLI functionality
  - Integration tests for cross-package interactions

The goal is to write tests that **catch regressions** and **document expected behavior**, not to achieve high coverage metrics.

## Project Overview

**@jsenv/core** is a comprehensive JavaScript development toolkit that prioritizes web standards and simplicity. It's organized as a monorepo with multiple packages serving different purposes:

- **Core Package**: Main toolkit providing dev server, build system, test runner, and build server
- **Monorepo Structure**: Organized packages in `packages/` with clear categorization:
  - `backend/*`: Node.js backend utilities
  - `frontend/*`: Frontend libraries and components
  - `internal/*`: Internal jsenv-specific packages
  - `private/*`: Private projects using jsenv
  - `related/*`: Complementary packages to @jsenv/core
  - `tooling/*`: Development and build tooling

## Key Architectural Principles

### 1. Standards-First Approach

- Built on web standards rather than custom abstractions
- Native ES modules support with dynamic imports
- Modern JavaScript features with progressive enhancement
- CSS with CSS variables for customizable styling systems

### 2. Plugin-Based Architecture

- Uses plugin patterns for dev server and build system extensibility
- Internal plugins configurable via API parameters
- External plugins as separate NPM packages
- Clear separation between core functionality and extensions

### 3. Signal-Based Reactive State Management

- Uses `@preact/signals` for reactive state across frontend packages
- Actions system built on signals for resource management
- Navigation state synchronized with browser history API

## Frontend Architecture (@jsenv/navi)

### Component System

- **Framework**: Preact with hooks (useRef, useEffect, useMemo, useCallback)
- **Styling**: CSS-in-JS with `import.meta.css` pattern
- **Forward Refs**: Consistent use of `forwardRef` for ref management
- **Composition**: Higher-order component patterns with `renderActionableComponent`

### Actions System

The actions system is the core of frontend data management:

```js
const getUserAction = createAction(async ({ userId }) => {
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
});

// Action Instances - Stateful objects with caching
const getUserWithIdAction = getUserAction.bindParams({ userId: 123 });

// Action Proxies - Reactive actions that reload on signal changes
const userProxy = createActionProxy(getUserAction, {
  userId: userIdSignal, // Reactive
  includeProfile: true, // Static
});
```

**Key Features**:

- Automatic memoization and request deduplication
- Concurrent loading control with abort signals
- Side effects with cleanup lifecycle
- Progressive loading (preload/load states)
- Async rendering support with `renderLoadedAsync`

### Component Patterns

#### Input Components

- **Base Pattern**: `Input` component with type-specific behavior
- **Field Wrapper**: `Field` component for labels, validation, constraints
- **Form Integration**: Automatic form parameter binding with `useActionBoundToFormParams`
- **Validation**: Integrated with `@jsenv/validation` package

#### Navigation Components

- **Link Component**: Enhanced `<a>` tags with action execution
- **Details Component**: Collapsible content with nav state persistence
- **Keyboard Shortcuts**: Integrated keyboard navigation support

## Development Workflow

### File Organization

- **Source Directory**: `src/` contains main implementation
- **Tests Directory**: `tests/` with comprehensive test suites
- **Experiments**: `experiments/` for proof-of-concepts
- **Documentation**: `docs/` with generated content and user guides

### Build System

- **Entry Point**: `src/main.js` with dynamic imports for tree-shaking
- **Distribution**: `dist/` for built files
- **Workspaces**: NPM workspaces for monorepo management
- **Conditional Exports**: Support for development vs production builds

## Coding Conventions

### JavaScript/JSX

- **ES Modules**: Always use ES module syntax
- **Dynamic Imports**: Lazy loading for code splitting
- **JSX**: Use Preact JSX pragma for frontend components
- **Async/Await**: Prefer async/await over Promise chains
- **Error Handling**: Comprehensive error boundaries and signal-based error states

### CSS

- **CSS-in-JS**: Use `import.meta.css` for component styles
- **CSS Variables**: Extensive use for theming and customization
- **Light-Dark Function**: `light-dark()` for automatic theme switching
- **Responsive Design**: Mobile-first approach with container queries

### File Naming

- **snake_case**: For directories and files
- **camelCase**: For JavaScript variables and functions
- **Extensions**: `.mjs` for scripts, `.jsx` for components, `.js` for modules

## Package-Specific Guidelines

### @jsenv/navi (Frontend Navigation)

- **Actions First**: Always use actions system for data fetching
- **Signal Integration**: Leverage signals for reactive state
- **Component Composition**: Use renderActionableComponent pattern
- **Accessibility**: Include ARIA attributes and keyboard navigation

### @jsenv/validation (Form Validation)

- **Constraint-Based**: Use constraint validation API
- **Message Positioning**: Smart positioning with `positionValidationMessage`
- **Real-time Validation**: Integrate with form field changes
- **Custom Validators**: Extend with custom validation logic

## Integration Guidelines

### New Components

1. **Start with Basic Version**: Implement without actions first
2. **Add Action Support**: Use `renderActionableComponent` pattern
3. **Include Accessibility**: ARIA attributes and keyboard support
4. **Add Tests**: Unit tests and integration tests
5. **Document Usage**: Include demo files and documentation

## Code Quality Standards

- **ESLint**: Follow established ESLint configuration
- **Prettier**: Consistent code formatting
- **Type Safety**: Use JSDoc comments for type hints
- **Testing**: Comprehensive test coverage for critical paths
- **Documentation**: Clear inline comments and external documentation

## Migration and Compatibility

- **Backward Compatibility**: Do not try to maintain it.
- **Deprecation Warnings**: You can deprecate and make breaking changes as long as we update package major version.
- **Migration Guides**: Do not proactively document upgrade paths for breaking changes. I'll request it if needed.
- **Feature Detection**: Progressive enhancement for new browser features

This guide should help AI coding agents understand the architecture, patterns, and conventions used throughout the @jsenv/core codebase, enabling them to contribute effectively while maintaining consistency with the existing codebase.

## Others

- Prefer named things (named params, named export over default export for example).
- Put helpers functions at the bottom of the file by default
- Put constants simple variables (everything except functions) above the function using them. For the exported function is means top of the file after imports. For helper function it means above them.
- Never write tests on your initiative.
- Never write documentation on your initiative.
- Never use Math.max/Math.min. Code becomes hard to follow. Prefer explicit branching.
- To add logs for debbuging, prefer console.debug and prefer plain sentence instead of objects. (Objects are harder to copy-paste)
