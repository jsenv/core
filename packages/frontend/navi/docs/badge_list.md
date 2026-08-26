# BadgeList

A row of badges that wraps. What it does at runtime depends on what it is asked
for, and nothing is set up for a case that cannot happen:

- **plain** — no `max`, no `maxLines`, no `fallback`, no `shrinkWrap`: one
  element holding its children as-is. No registry, no effect, no measurement.
- **`max` / `fallback`** — the badges are counted (see below), nothing is
  measured, no DOM is watched.
- **`shrinkWrap`** — a hidden clone of the list is laid out to find the widest
  wrapped row, and the list is narrowed to it so the last row isn't ragged.
  Opt-in outside a `Picker` (a picker draws a border around the list, so the
  ragged edge shows; elsewhere the work would often go unseen). With `maxLines`
  the rows are read first, at the full width, and the list is narrowed once the
  surplus is gone — in place, no clone.
- **`maxLines`** — every badge is laid out once, hidden; where the rows fell is
  read; the list is rendered again with the badges that fit and a `+N more`
  badge for the rest. Both renders land in the same frame. A width change of
  the room around the list triggers another measure — not a change of the
  list's own width, which is what it produces, not what it is given.

## How badges are counted

A `Badge` inside a `BadgeList` does not render itself: it hands its props to
the list through `BadgeListContext` and renders nothing. Badges register in
tree order, so by the time the list gets to its own content it holds them all
and knows how many there are before deciding what to show — without walking
children vnodes, and without rendering a badge it then has to take back.

Two consequences:

- a `Badge` must be a **direct** child of the list — its rendering is moved
  into the list, so `<div><Badge /></div>` takes the badge out of its wrapper;
- a badge's own `key` goes to the registering vnode and not to the badge the
  list draws, which is keyed by position. Reordering recreates the nodes rather
  than moving them.

## `maxLines` in a Picker

A picker clamps its value with `maxLines`, which is CSS line-clamp — it counts
line boxes of inline text and never sees a wrapped flex row. So a `BadgeList`
rendered as a picker's `ui` reads the number from `MaxLinesContext` instead
(the picker provides it, default 1) and caps its own rows to it, and the picker
turns its own clamp off (`.navi_picker_value:has(.navi_badge_list)`). Nothing
to set on the list; `maxLines` on the picker is enough, and a `maxLines` on the
list itself is a local override.

`max` is a different cap: a number of badges, whatever the rows. The two
compose — the `+N` badge takes one of the `max` slots.

## The `fallback`

Without a `fallback`, an empty list renders **nothing**. Inside a picker there
is one more thing to know: a picker given a `ui` draws that and only that, its
own `placeholder` is **not** drawn next to it. An empty `BadgeList` in a picker
is a blank picker — so the list's `fallback` is the placeholder, and the
placeholder text is what to pass:

```jsx
<BadgeList fallback="Select skills…">
  {selected.map((skill) => (
    <Badge key={skill}>{skill}</Badge>
  ))}
</BadgeList>
```

Plain text is the right shape for it. It reads at the picker's own size, in the
placeholder color — the picker colors its value slot that way while it holds
nothing — and the picker box stays the same height empty and filled: the box is
held one line tall by the picker's own line (the right slot is `1lh`), whatever
the slot inside holds. That slot is a fraction of a pixel taller with a line of
text than with a row of badges (0.89px at the default font size — a line is set
by the picker's font and line-height, a badge by its own padding and smaller
font), which nothing shows.

A transparent `Badge` as fallback matches the slot to the pixel instead, but its
text is badge-sized — smaller than the picker's — and reads as a badge with
nothing in it. Only worth it where the slot itself is what something else is
sized on. Section 4 of `src/control/demos/picker/2_select_multiple_demo.html`
measures the three cases (no fallback, plain text, transparent badge), box and
slot side by side.
