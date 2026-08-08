---
name: new-component
description: Workflow for creating a new UI component in @jsenv/navi. Use when implementing a new frontend component from scratch.
---

## What we want

A new component must feel like it was always part of navi: same layering
(plain rendering first, actions on top, accessibility throughout), same
wrappers, same prop conventions as its siblings. The steps below exist to
produce that consistency — when in doubt, open the closest existing component
and match it rather than inventing.

## Steps

1. **Start with Basic Version**: Implement the component without actions first
2. **Add Action Support**: Use the `renderActionableComponent` pattern to wire up data fetching
3. **Include Accessibility**: Add ARIA attributes and keyboard navigation support

Tests and documentation are not part of the workflow — they happen only on
request (see the constraints in
[.agents/instructions.md](../../instructions.md#constraints)).

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
