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

1. **Start with the basic version**: the component rendering its value, with
   nothing wired.
2. **Add the control layer**: a control gets its value, `action`/`uiAction`,
   busy and error states from `useControlProps` (`src/control/control_hooks.jsx`),
   the way `input_textual.jsx`, `select.jsx` or `button_ui.jsx` do — never from
   state of its own. Variants that need different hooks are split with a
   resolver chain (see "Hooks are never conditional" in
   [.agents/instructions.md](../../instructions.md#javascript--jsx)).
3. **Include accessibility**: ARIA attributes and keyboard support; anything
   that moves the focus follows the [focus skill](../focus/SKILL.md).

Tests and documentation are not part of the workflow — they happen only on
request (see the constraints in
[.agents/instructions.md](../../instructions.md#constraints)).

## Patterns to follow

- **A value is refused through constraints**, fed by `@jsenv/validity` rules
  where the rule is about the value — see
  [field_validation.md](../../../packages/frontend/navi/docs/field_validation.md).
- **A control that can be grouped** declares the radius of its frame on its own
  root and answers `<Group>`'s corner claims — see "Writing a control that
  belongs in a group" in
  [control_group.md](../../../packages/frontend/navi/docs/control_group.md).
  Never hand-write negative margins or per-member radius resets.
- **JSDoc** on every exported component: see "JSDoc" in
  [.agents/instructions.md](../../instructions.md#jsdoc).
