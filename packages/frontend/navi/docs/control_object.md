# A value made of several controls

One question, answered by more than one control: a day and two wheels that make
"mardi 19h", three fields that make an address, two wheels that add up to a
number of minutes. Navi has one mechanism for that — a group aggregates what its
children hold into a single value, and hands it back the same way — and three
places it shows up. This file says which one to reach for, and what a picker
whose value is an object needs in its popup.

- [`<ControlGroup>`: the shape](#controlgroup-the-shape)
- [`<Form>`: the shape, plus a send](#form-the-shape-plus-a-send)
- [Naming, and what a nameless group does](#naming-and-what-a-nameless-group-does)
- [A picker whose value is an object](#a-picker-whose-value-is-an-object)
- [`Group` is not `ControlGroup`](#group-is-not-controlgroup)

## `<ControlGroup>`: the shape

A group with no opinion beyond the shape of its value: it aggregates its named
children into an object, distributes an object back down to them, and carries
its own `action`/`uiAction`/`command` if you want one.

```jsx
<ControlGroup name="address">
  <Input name="street" />
  <Input name="city" />
  <Input name="zip" />
</ControlGroup>
// worth { street, city, zip }
```

It is also the brick composite controls are built from:
`aggregateChildStates` / `distributeChildUIState` replace "one key per child"
with a value of your own — two wheels that are one number of minutes, three
fields that are one date. A group with them takes and hands back a single
value, so it can be driven by one `value`/`signal` like any other control. It is
what `SpinTime` is made of, and the same mechanism `InputDuration`, `SpinGroup`
and `WheelGroup` use for their own members.

## `<Form>`: the shape, plus a send

A `<Form>` aggregates exactly the same way. What it adds is everything about
**sending**: the reference it measures against, the refusal to act when nothing
changed (see [form_changed.md](./form_changed.md)), the submit button and its
`readOnlyWhileFormUnchanged`, what follows a successful send (`command`), and a
`<form>` element with the browser's own submit/reset.

So the choice is not about the value, it is about whether this cluster is a
**question with a send**:

- a shape inside a bigger whole → `ControlGroup`;
- something the user sends → `Form`.

A `<Form>` inside a `<Form>` is legal — the inner one becomes a group without
the `<form>` element — but it carries all of the above with it: its own
reference, its own "nothing changed", its own submit story. Grouping three
fields into a sub-object should cost none of that.

## Naming, and what a nameless group does

A group's `name` is the key its value lands under, in the group above it. This
is true of a `ControlGroup` and of a nested `Form` alike.

Left nameless, a group is a **grouping**: it exists to hold its children
together (shared navigation, a visual cluster) without claiming a key, and what
it holds is merged into the object around it as if its children had been written
there.

```jsx
<ControlGroup name="when">
  <DaySpin name="day" />
  <WheelGroup>
    <Wheel name="hours" />
    <Wheel name="minutes" />
  </WheelGroup>
</ControlGroup>
// worth { day, hours, minutes } — the WheelGroup adds no key of its own
```

A nameless **leaf** is a different story: it is a control whose value has
nowhere to go, and it is warned about. When that is deliberate — a control that
only opens something — say so with `allowNameless` (see
[form_changed.md](./form_changed.md#a-control-that-is-not-a-field)).

## A picker whose value is an object

`type="object"` is the picker whose value is what the group in its popup
aggregates (next to `type="array"`, whose value is a selection):

```jsx
<Picker name="when" type="object" value={{ day, hours, minutes }}>
  <ControlGroup>
    <DaySpin name="day" signal={daySignal} />
    <WheelGroup>
      <Wheel name="hours" signal={hoursSignal} />
      <Wheel name="minutes" signal={minutesSignal} />
    </WheelGroup>
  </ControlGroup>
</Picker>
```

Two things to get right:

- **One control in the popup, and it must be the group.** A picker syncs with a
  single control: the first one receives the picker's whole value and is the
  only one read back. Two controls side by side in a popup is the shape to
  avoid — the second is neither filled nor collected, and navi says so in dev.
  Wrap them in one `ControlGroup` (or one `Form`, when the popup has a send of
  its own).
- **The value travels by name.** What the picker was given goes down into the
  group, which hands each named child its own key; a nameless grouping inside
  receives the whole object and picks out what it names. Give a picker of this
  kind a scalar type and there is no group to distribute anything — the whole
  object lands on one control, which is how `"[object Object]"` ends up in a
  url.

## `Group` is not `ControlGroup`

Two names, two subjects, no relation:

- `<Group>` is about the **frame** — several controls reading as one object to
  the eye, one border per seam. See [control_group.md](./control_group.md).
- `<ControlGroup>` is about the **value** — several controls reading as one
  object to the action.

They compose: a `Group` around controls that also happen to be a
`ControlGroup`'s children is fine, and either can exist without the other.

## See also

- [form_changed.md](./form_changed.md) — what a form sends, and what it measures
  against
- [control_value.md](./control_value.md) — who holds a single control's value
- [control_group.md](./control_group.md) — the visual `<Group>`
