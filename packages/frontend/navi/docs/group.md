# Grouping controls (`<Group>`)

What we want: **several controls reading as one object.** A search input and
its button, a row of segmented buttons, a column of setting rows — when they
belong together, the eye should see one frame with divisions inside it, not
three boxes that happen to touch: one border along each seam instead of two side
by side, and a radius only on the four outer corners.

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

`row` (or `vertical`, the same prop — each member is a row, so they stack
vertically and meet along horizontal seams) is the only prop that changes the
arrangement; everything else is read off the members themselves. Say it rather
than `flex="y"`: the seams follow `row`, not the layout.

Live examples: `src/control/demos/15_group_demo.html`.

## What Group does to its members

- **Seams**: a member with a member before it is pulled back by one border
  width, so the two borders along a seam become one line — the member's own
  `--border-width` when it declares one, else the group's `--group-border-width`
  (default: `--navi-control-border-width`).
- **Corners**: a member loses the radius on each side where it faces another
  member. A single member keeps its own radius — a group of one looks like the
  control alone.
- **Members only**: a child out of the group's flow is none of its business. A
  popup renders inside its opener's subtree, so a `Dialog` or `Popover` written
  next to the button that opens it is a child of the group, backdrop included; a
  callout anchored on a `<button>` is mounted in that button's parent. They mark
  themselves `navi-out-of-flow`, and the group skips them: none takes a corner,
  none moves anyone else's (a row of one button and the dialog it opens is still
  a group of one), none is pulled back by a border width.
- **Overlap order**: the member hovered, the one showing a focus ring (on itself
  or inside it), and the one holding something open (`aria-expanded="true"`)
  paint above their neighbours, so their border and ring are not sliced
  (`--navi-z-index-control-hovered` / `-focused` / `-expanded`, expanded
  highest). The group is deliberately not isolated — see
  [z_index.md](./z_index.md#why-a-group-member-is-not-isolated).

Nothing else: a group does not restyle its members, does not impose a size,
and takes any `Box` prop for its own layout.

## Writing a control that belongs in a group

A group never writes a selector that reaches inside a member — a member's
subtree holds more than the member (a `Picker` renders its popup inside itself;
a control carries buttons of its own, like the clear cross in a slot), and a
rule matching "some descendant" finds all of them. It asks for a square corner
in two forms instead, and a control answers with whichever fits.

**The property, on the member itself.** A control declares the radius of its
frame on its own root, and whatever inner element paints that frame takes
`border-radius: inherit`:

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

**The custom property, which travels.** A member is not always the control that
carries the frame: a button can arrive wrapped in a tooltip or a link, at any
depth. So the group also sets `--x-corner-top-left-radius` and its three
siblings on the member, and a control that can arrive wrapped reads them as an
override of its own radius. The `--x-` prefix marks navi's internal wiring, not
a surface an app writes to (an app changes a radius with the `borderRadius`
prop, which lands in the fallback):

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
way down, so the control that consumed a corner sets the four back to `initial`
on the first element inside it — otherwise a button in a slot, or the Save
button of a form in an open popup, reads a corner meant for the row that opened
it. `Popover` and `Dialog` stop it at their own root. **A member drawing the
frame itself stops it too**: a `Box` that paints a background or a border, or
insets what it holds with padding, is what the outer corner belongs to, and
marks itself `navi-box-frame` to stop the claims for everything inside. A
wrapper adding neither — a tooltip, a link, a bare `<Box>` — lets them through
to the control that really carries the frame.

A control that declares its radius on an inner element instead is invisible to
`Group`: it keeps round corners in the middle of the row, and no rule in
`group.jsx` can reach it without naming that private class. Fix the control, not
the group. The controls shipped by navi all follow this: `Button`, `Input`,
`Select`, `Picker`, `Spin`, checkbox, range.

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
