# AI Coding Agent Instructions for @jsenv/core

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

#### Button Components

- **CSS Variables**: Extensive use of CSS variables for customization:
  - `--button-border-width`: Dynamic border sizing
  - `--button-outline-width`: Focus outline control
  - `--button-border-color`: Border color theming
- **Loading States**: SVG-based loaders with network-aware animation speeds
- **Active Effects**: Visual feedback with SVG pressed effects

#### Navigation Components

- **Link Component**: Enhanced `<a>` tags with action execution
- **Details Component**: Collapsible content with nav state persistence
- **Keyboard Shortcuts**: Integrated keyboard navigation support

### State Management Patterns

#### Navigation State

```js
// Persisted in browser navigation history
const [value, setValue, clearValue] = useNavState(id, initialValue);
```

#### Action Status

```js
const { idle, pending, aborted, error, data } = useActionStatus(action);
```

#### Ref Management

```js
// Custom hook for managing arrays of refs
const getRef = useRefArray();
const elementRef = getRef(id);
```

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

- **kebab-case**: For directories and most files
- **camelCase**: For JavaScript variables and functions
- **PascalCase**: For component files and classes
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

## Performance Considerations

### Frontend Optimization

- **Bundle Splitting**: Use dynamic imports for code splitting
- **Signal Efficiency**: Minimize signal computations and dependencies
- **Memory Management**: Use WeakMap for private properties to prevent leaks
- **Request Deduplication**: Actions automatically deduplicate identical requests

### Build Optimization

- **Tree Shaking**: Optimize imports and exports for tree shaking
- **Asset Optimization**: Use build system for image and resource optimization
- **Cache Busting**: Robust versioning to avoid cascading hash changes
- **Browser Compatibility**: Support modern and older browsers

## Debugging and Development

### Debug Modes

- **Action Debugging**: Enable with `debug = true` for detailed action logging
- **Navigation Debugging**: Browser navigation state tracking
- **Component Debugging**: Development-only warnings and validation

### Development Tools

- **Hot Reload**: Automatic reloading during development
- **Source Maps**: Accurate debugging with source map support
- **Error Boundaries**: Comprehensive error catching and reporting
- **Performance Monitoring**: Built-in performance measurement tools

## Integration Guidelines

### New Components

1. **Start with Basic Version**: Implement without actions first
2. **Add Action Support**: Use `renderActionableComponent` pattern
3. **Include Accessibility**: ARIA attributes and keyboard support
4. **Add Tests**: Unit tests and integration tests
5. **Document Usage**: Include demo files and documentation

### New Actions

1. **Define Template**: Create reusable action template
2. **Add Caching**: Use appropriate cache keys for memoization
3. **Handle Errors**: Implement proper error boundaries
4. **Add Side Effects**: Include cleanup logic if needed
5. **Test Scenarios**: Test loading, error, and success states

### Plugin Development

1. **Follow Plugin Pattern**: Use established plugin architecture
2. **Configuration Options**: Expose relevant configuration parameters
3. **Error Handling**: Graceful degradation and error reporting
4. **Documentation**: Clear usage examples and API documentation
5. **Testing**: Integration tests with core system

## Code Quality Standards

- **ESLint**: Follow established ESLint configuration
- **Prettier**: Consistent code formatting
- **Type Safety**: Use JSDoc comments for type hints
- **Testing**: Comprehensive test coverage for critical paths
- **Documentation**: Clear inline comments and external documentation

## Migration and Compatibility

- **Backward Compatibility**: Maintain compatibility when possible
- **Deprecation Warnings**: Clear warnings before breaking changes
- **Migration Guides**: Document upgrade paths for breaking changes
- **Feature Detection**: Progressive enhancement for new browser features

This guide should help AI coding agents understand the architecture, patterns, and conventions used throughout the @jsenv/core codebase, enabling them to contribute effectively while maintaining consistency with the existing codebase.
