---
name: new-component
description: Workflow for creating a new UI component in @jsenv/navi. Use when implementing a new frontend component from scratch.
---

## Overview

New components in `@jsenv/navi` follow a consistent pattern: start simple, layer in action support, then add accessibility.

## Steps

1. **Start with Basic Version**: Implement the component without actions first
2. **Add Action Support**: Use the `renderActionableComponent` pattern to wire up data fetching
3. **Include Accessibility**: Add ARIA attributes and keyboard navigation support
4. **Add Tests**: Only if requested — never on your initiative
5. **Document Usage**: Only if requested — never on your initiative

## Patterns to Follow

### Input Components

- `Input` component with type-specific behavior
- `Field` wrapper for labels, validation, constraints
- `useActionBoundToFormParams` for form integration
- Validation via `@jsenv/validation`

### Navigation Components

- Enhanced `<a>` tags with action execution for links
- `Details` component for collapsible content with nav state persistence
- Integrated keyboard shortcut support

## JSDoc

Add a `@type {import("preact").FunctionComponent<{ ... }>}` JSDoc block above every exported component so VSCode can autocomplete props.
