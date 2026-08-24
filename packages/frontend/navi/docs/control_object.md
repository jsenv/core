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
- [One line, one key](#one-line-one-key)
- [A settings sheet](#a-settings-sheet)
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
- **A control that helps FIND the answer is not the answer.** A search box above
  a long list, a "select all" beside it: they are tools, and a tool says so with
  `allowNameless`. The picker then walks past it and talks to the list, which is
  what a popup made of one choice and the means to reach it needs.

```jsx
<Picker name="place_ids" type="array">
  <Input allowNameless placeholder="chercher" navi-list="places" />
  <List id="places" selectable multiple>
    …
  </List>
</Picker>
```

## One line, one key

A row that opens a popup is one control, so what it answers arrives under its
one name. A row answering two questions at once — where the level comes from
AND which levels, when it starts AND when it ends — hands back a sub-object:

```jsx
<Picker name="level" type="object">   // { level: { level_mode, levels } }
<Picker name="hours" type="object">   // { hours: { from_minute, to_minute } }
```

Flattening those into the sent object is the caller's business
(`{ ...value.level, ...value.hours }`), and it is the only reasonable place for
it: a picker with no name of its own could not be collected, and one merging its
keys into the object around it would take the row's own identity away — nothing
would say which row a key came from, nor which row to put an incoming value
back on. A `<ControlGroup>` with no name IS that merge, and it exists for the
case where there is no row: several controls in one screen, no door between
them.

## A settings sheet

A popup that is not one choice but a handful of settings — four tabs, a select,
a field, a button that answers with a place — and ONE answer, which must reach
the app only when the popup closes. The list behind it must not move while it is
open, and Escape must leave things exactly as they were found.

Nothing new is needed for that: it is the object picker above, with the group in
its popup. A picker's `action` runs on close and only on close (its `uiAction`
follows every gesture, which is what the popup shows), so what is inside acts on
nothing until the user is done.

```jsx
<Picker
  type="object"
  mode="dialog"
  value={zone}
  ui={<ZoneSummary zone={zone} />}
  action={save}
>
  <ControlGroup>
    <Nav slideContainer="zone_slides" currentIndicator>
      <Link slide="city">Ville</Link>…
    </Nav>
    <Input type="hidden" name="origin" signal={originSignal} />
    <SlideContainer id="zone_slides" signal={originSignal}>
      <Slide area="city">
        <Input name="city" />
      </Slide>
      …
    </SlideContainer>
  </ControlGroup>
</Picker>
```

```js
// what `save` receives, on close and once
{ origin: "city", city: "Antibes", radius: "30", department: "" }
```

**Which tab is showing is part of the answer.** The same fields mean different
things depending on the tab they were filled on, so the tab is a key of the
value like the rest — a sheet handing back `{ city: "Antibes" }` without saying
which tab it was left on has not said what was chosen. A tab bar is a navigation
(`<Nav slideContainer>` + `<Link slide>`), so nothing in it is a field: the
current area reaches the value through an `<Input type="hidden">` bound to the
same signal as the container. That is what a hidden field is for — a
piece of the answer with no control to be read from, here because the tabs are
places rather than choices. A tab bar made of radios needs none: it is a field
already, under its own name.

That signal is written in both directions, which is what makes the sheet reopen
where it was left: a value handed DOWN to a control writes it too — on open, and
when Escape puts back what the picker held — so the tabs go back to the answer
rather than staying on the one that was being tried.

**Every field answers, including the ones the current tab does not use.** A
field on another tab stays mounted, keeps what was typed in it, and comes back
in the object. Which of them count is read from `origin` by whoever receives the
value — the group has no opinion about it, and does not need one. Deriving
something narrower (a stored string, an id) is that reader's business too:
`action` receives the object and stores whatever it wants, `value` hands the
object back.

A group CAN be worth a single value of its own — `aggregateChildStates` and
`distributeChildUIState`, see the top of this file — and a sheet is precisely
where that is the wrong reach: it throws away the state that makes the answer
readable, starting with the tab.

**A button inside is not a field.** The one asking for a position acts on the
press, like anywhere else; what it answers goes into a control that IS a field
(a read-only one showing the place it found), and the group picks it up from
there.

The façade stays on what is saved by reading the app's own state
(`value={zone}` + a `ui` rendered from `zone`), while the picker holds the
draft: the summary behind the open dialog then shows the answer, not the
attempt.

Seen working — the tabs, the geolocation button, the cancel — in
`control/demos/picker/9_picker_settings_sheet_demo.html`.

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
