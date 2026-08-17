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
  control alone.
- **Overlap order**: the member under the pointer, and the member showing a
  focus ring, paint above their neighbours (`position: relative` plus
  `--navi-z-index-control-hovered` / `-focused`). Without it the border color
  change and the focus ring of the active member would be sliced by whichever
  neighbour is painted after it. The focused member is matched whether it wears
  `data-focus-visible` itself or merely contains it — a control that wraps a
  real input (`Picker`, `Spin`) draws the ring on its own frame while the
  keyboard is held inside. There is deliberately no `isolation: isolate` — see
  [z_index.md](./z_index.md).

Nothing else: a group does not restyle its members, does not impose a size,
and takes any `Box` prop for its own layout.

## Writing a control that belongs in a group

A group squares the corners of its **direct children** — it addresses the
control root, never the elements inside it. So a control declares the radius
of its frame on its own root element, and whatever inner element actually
paints the frame takes `border-radius: inherit`:

```css
.navi_thing {
  /* The radius is declared here even though the frame below draws it */
  border-radius: var(--thing-border-radius);

  .navi_thing_box {
    border: ...;
    border-radius: inherit;
  }
}
```

A control that declares its radius on an inner element instead is invisible to
`Group`: it keeps round corners in the middle of the row, and no rule written
in `group.jsx` can reach it without naming that private class — which is how a
layout component ends up knowing the internals of every control. When you meet
that symptom, fix the control, not the group.

The controls shipped by navi all follow this: `Button`, `Input`, `Select`,
`Picker`, `Picker.Spin`, checkbox, range.

## When it is not a Group

- Controls separated by space, each with its own frame — that is a `Box` with
  `spacing`, they were never one object.
- A label and its control — that is `Field`.
- Radio buttons or checkboxes sharing a name and a validation — that is
  `RadioGroup` / `CheckboxGroup`, which is about the value, not the frame. They
  can be put inside a `Group` if you also want them to share a frame.
