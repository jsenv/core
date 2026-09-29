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
  [group.md](../../../packages/frontend/navi/docs/group.md).
  Never hand-write negative margins or per-member radius resets.
- **JSDoc** on every exported component: see "JSDoc" in
  [.agents/instructions.md](../../instructions.md#jsdoc).

### A variant sets defaults, never resolved values

A control resolves each styled property in two steps: the public variable holds
what was asked for (`--picker-background-color`), an internal `--x-` variable
what is finally painted, per state:

```css
.navi_picker {
  --x-picker-background-color: var(--picker-background-color);

  &[data-hover] {
    --x-picker-background-color: var(--picker-background-color-hover);
  }
}
```

A variant (`icon`, `discrete`, `bare`, `border`, `headless`…) describes what
the caller did **not** say, so it writes the public variable — the default —
and never the `--x-` one:

```css
&[data-variant="icon"] {
  /* ✅ a default: a backgroundColor prop, inline on this same element, wins */
  --picker-background-color: transparent;
  /* ❌ a verdict: the prop is read, translated, and then thrown away */
  --x-picker-background-color: transparent;
}
```

Writing `--x-` from a variant is the failure that costs real time to diagnose:
the prop is accepted, reaches its variable with the right value, and nothing
happens. Two things come with moving the default:

- the **per-state** variables are derived from the base one by formula (hover
  = 5% black over the background, disabled = 5% grey), so a variant that clears
  the background re-points them at the base
  (`--picker-background-color-hover: var(--picker-background-color)`), or a box
  reappears on hover. A resting movement is a mix **into** the background
  (`color-mix(in srgb, currentColor 8%, var(--picker-background-color))`), so it
  still composes with a color the caller gave;
- a variable fed by another prop keeps that chain in its fallback:
  `--button-background-color: var(--button-background, transparent)` leaves both
  `background` and `backgroundColor` working.

The same holds for sizing: a variant lowers `--picker-padding-x-default`, not
`--x-picker-padding-left`.
