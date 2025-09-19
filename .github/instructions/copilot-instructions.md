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

### Testing Strategy

- **Test Files**: Co-located with source or in dedicated `tests/` directories
- **Browser Testing**: Automated browser testing with Playwright
- **Node.js Testing**: Server-side testing for backend components
- **Snapshot Testing**: Side effects and build output verification

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
- Don't write tests on your initiative.
- Don't write documentation on your initiative.
