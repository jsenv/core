# Grouping controls (`<Group>`)

What we want: **several controls reading as one object.** A search input and
its button, a row of segmented buttons, a column of setting rows — when they
belong together, the eye should see one frame with divisions inside it, not
three boxes that happen to touch. Concretely that means: one border along each
seam instead of two side by side, and a radius only on the four outer corners.

`<Group>` is what produces that. Reach for it whenever you place controls
against each other and any of them has a border or a radius — never hand-write
negative margins, `border-radius: 0` overrides, or a `borderRadius` prop set to
`0` on the middle members. Those spellings look right on the case you are
looking at and break on the next one: a member added at the end, a member
hidden by a condition (the "first" is then the second child), a switch from row
to column.

```jsx
<Group>
  <Input name="search" placeholder="Search…" />
  <Button>Go</Button>
</Group>
```

Stacked, one setting per row:

```jsx
<Group row>
  <Picker name="side" ui={…} expandX />
  <Picker name="level" ui={…} expandX />
  <Picker name="city" ui={…} expandX />
</Group>
```

`row` (a `Box` prop — its children are laid out as rows, so they stack
vertically) is the only prop that changes the arrangement; everything else is
read off the members themselves.

Live examples: `src/control/demos/15_group_demo.html`.

## What Group does to its members

- **Seams**: each member after the first is pulled back by one border width, so
  the two borders along a seam become one line. The width comes from the
  member's own `--border-width` when it declares one, else from the group's
  `--group-border-width` (default: `--navi-control-border-width`).
- **Corners**: the first member loses the radius on the side that joins, the
  last one loses it on the other side, and any member in between loses all
  four. A single member keeps its own radius — a group of one looks like the
  control alone. The ask is made twice, in two forms — see below.
- **Overlap order**: the member under the pointer, the member showing a focus
  ring, and the member holding something open (`aria-expanded="true"`) paint
  above their neighbours (`position: relative` plus
  `--navi-z-index-control-hovered` / `-focused` / `-expanded`). Without it the
  border color change and the focus ring of the active member would be sliced
  by whichever neighbour is painted after it. The focused member is matched
  whether it wears `data-focus-visible` itself or merely contains it — a
  control that wraps a real input (`Picker`, `Spin`) draws the ring on its own
  frame while the keyboard is held inside; the expanded member is matched the
  same way, since it can be wrapped in an enrobage. Expanded ranks highest: a
  `Picker` opened by a click shows no focus ring, hands the focus to its popup
  and lets the pointer travel to a neighbour, yet its border keeps saying it is
  the one open. There is deliberately no `isolation: isolate` — see
  [z_index.md](./z_index.md).

Nothing else: a group does not restyle its members, does not impose a size,
and takes any `Box` prop for its own layout.

## Writing a control that belongs in a group

A group never writes a selector that reaches inside a member — a member's
subtree holds more than the member (a `Picker` renders its popup inside
itself, not in a portal; a control carries buttons of its own, like the clear
cross in a slot), and a rule matching "some descendant" finds all of them. It
asks for a square corner in two forms instead, and a control answers with
whichever fits.

**The property, on the member itself.** A control declares the radius of its
frame on its own root, and whatever inner element paints that frame takes
`border-radius: inherit`. The group sets the property on the root; the frame
follows.

```css
.navi_thing {
  /* Declared here even though the box below is what draws it */
  border-radius: var(--thing-border-radius);

  .navi_thing_box {
    border: ...;
    border-radius: inherit;
  }
}
```

**The custom property, which travels.** A member is not always the control
that carries the frame: a button can arrive wrapped in a tooltip or a link, at
any depth. So the group also sets `--x-corner-top-left-radius` and its three
siblings on the member, and a control that can arrive wrapped reads them as an
override of its own radius. The `--x-` prefix says what they are: navi's
internal wiring between a group and its members, not a surface an app writes
to (an app changes a radius with the `borderRadius` prop, which lands in the
fallback below and is what the corner keeps everywhere the group has no claim):

```css
.navi_thing {
  border-top-left-radius: var(
    --x-corner-top-left-radius,
    var(--thing-border-radius)
  );
  /* …and the three others */
}
```

**Whoever answers the ask also stops it.** Custom properties inherit all the
way down, so the control that consumed a corner sets the four back to
`initial` on the first element inside it — otherwise a button in a slot, or the
Save button of a form in an open popup, reads a corner meant for the row that
opened it. `Popover` and `Dialog` stop it too, at their own root: nothing a
popup holds is at a seam.

Reference: `.navi_button_content` in `button_ui.jsx` (a button reads then
stops), `.navi_picker_box`, `.navi_input_slot`, `.navi_popover`,
`.navi_dialog`.

A control that declares its radius on an inner element instead is invisible to
`Group`: it keeps round corners in the middle of the row, and no rule written
in `group.jsx` can reach it without naming that private class — which is how a
layout component ends up knowing the internals of every control. When you meet
that symptom, fix the control, not the group.

The controls shipped by navi all follow this: `Button`, `Input`, `Select`,
`Picker`, `Spin`, checkbox, range.

## When it is not a Group

- Controls separated by space, each with its own frame — that is a `Box` with
  `spacing`, they were never one object.
- A label and its control — that is `Field`.
- Several controls making ONE value between them (an address out of three
  fields, a day and two wheels out of one moment) — that is `ControlGroup`,
  which is about the value and draws nothing. Same word, other subject: see
  [control_object.md](./control_object.md). Both at once is fine — a `Group`
  around the members of a `ControlGroup`.
- Radio buttons or checkboxes sharing a name and a validation — that is
  `RadioGroup` / `CheckboxGroup`, which is about the value, not the frame. They
  can be put inside a `Group` if you also want them to share a frame.
- Controls that are ONE value between them, with a word written inside the frame
  (the hours and the minutes of "07h30") — that is `SpinGroup`, which drops the
  members' frames rather than joining them.
