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
- [A group holds what it was given](#a-group-holds-what-it-was-given)
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

It is also the brick composite controls are built from: with
`aggregateChildStates` / `distributeChildUIState` (see its JSDoc) a group takes
and hands back a single value of your own — two wheels that are one number of
minutes, three fields that are one date — and is driven by one `value`/`signal`
like any other control. `TimeRangeSpin` is a `ControlGroup` of two `TimeSpin`s;
`SpinGroup` (which a `TimeSpin` is), `WheelGroup` and `InputDuration` use the
same mechanism for their own members.

## `<Form>`: the shape, plus a send

A `<Form>` aggregates exactly the same way. What it adds is everything about
**sending**: the reference it measures against, the refusal to act when nothing
changed (see [form_changed.md](./form_changed.md)), the submit button and its
`readOnlyWhileFormUnchanged`, what follows a successful send (`command`), and a
`<form>` element with the browser's own submit/reset. So the choice is not
about the value, it is about whether this cluster is a **question with a send**:

- a shape inside a bigger whole → `ControlGroup`;
- something the user sends → `Form`.

A `<Form>` inside a `<Form>` is legal — the inner one becomes a group without
the `<form>` element — and it is a **second question**, not a sub-object of the
first: what it holds is its own, and the form around it never sees it. Not in
the value it sends, not in its "nothing changed", and not in the constraints it
checks before sending — a required field in a popup nobody opened cannot refuse
the outer submit and point at something the screen is not showing. Grouping
three fields into a sub-object should cost none of that — that is a
`ControlGroup`.

## Naming, and what a nameless group does

A group's `name` is the key its value lands under, in the group above it — a
`ControlGroup`, or a `Form` inside something that is not a form (a picker, say).
A form inside a form lands nowhere: it answers for itself, named or not.

Left nameless, a group is a **grouping**: it holds its children together (shared
navigation, a visual cluster) without claiming a key, and what it holds is
merged into the object around it as if its children had been written there.

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

A nameless **leaf** is a different story: a control whose value has nowhere to
go, and it is warned about — unless it is not answering this group's question at
all, which it says with `standalone`
([form_changed.md](./form_changed.md#a-control-that-answers-for-itself)).

## A picker whose value is an object

`type="object"` is the picker whose value is what the group in its popup
aggregates (next to `type="array"`, whose value is a selection):

```jsx
<Picker name="when" type="object" signal={whenSignal}>
  <ControlGroup>
    <DaySpin name="day" />
    <WheelGroup>
      <Wheel name="hours" />
      <Wheel name="minutes" />
    </WheelGroup>
  </ControlGroup>
</Picker>
// whenSignal holds { day, hours, minutes }
```

- **One control in the popup, and it must be the group.** A picker syncs with a
  single control: the first one receives the picker's whole value and is the
  only one read back; a second one beside it is neither filled nor collected,
  and navi says so in dev. Wrap them in one `ControlGroup` (or one `Form`, for a
  popup with a send of its own — only while the picker is not inside a form: a
  form inside a form answers for itself, leaving the picker nothing to fill).
- **The value travels by name.** The group hands each named child its own key;
  a nameless grouping inside receives the whole object and picks out what it
  names. Give such a picker a scalar type and the whole object lands on one
  control — which is how `"[object Object]"` ends up in a url.
- **A control that helps FIND the answer is not the answer.** A search box
  above a long list, a "select all" beside it are tools, marked `standalone`:
  the picker walks past them to the list. Never put it on the control that IS
  the value — the picker would have nobody left to fill, and the popup would
  open blank on a value it holds.

```jsx
<Picker name="place_ids" type="array">
  <Input standalone placeholder="chercher" navi-list="places" />
  <List id="places" selectable multiple>
    …
  </List>
</Picker>
```

A popup can also hold **no** answer for the picker: several lists that are the
same one choice, each acting on every touch, nothing read back on close. Mark
them all `standalone` and the picker talks to none of them — rather than one
`ControlGroup` around them, whose value would be one key per list where the
answer is a single value.

## A group holds what it was given

A group's value looks like it is made of its children, and mostly it is — but
not while the children are not all there yet:

- a group **told** a value holds it whole, before any child has registered to
  show it: items still loading, a popup built at open, a row scrolled out of a
  virtualized list do not make the value smaller;
- **a child mounting or unmounting is not somebody answering.** While children
  arrive, their aggregate is a partial reading; the group takes it for its value
  only once it derived that value itself (nobody handed it one), or once a child
  really acts;
- a child arriving **after** the value did is placed from what the group holds;
  one arriving with something of its own to show is answering, and keeps it. A
  child bound to a `signal` is placed like any other — bound is not frozen — and
  the placement writes the signal, so an `<Input type="hidden" signal>` carrying
  a piece of the answer shows what the group holds. Only a child controlled by a
  `value`/`checked` prop is left alone: its owner decides.

When children cannot be placed one at a time — four seats where who sits down
decides who moves — `distributeChildStates(groupValue, children) => Map` places
them all at once (see the `ControlGroup` JSDoc). It closes the loop: the group
holds ONE answer its children are views OF, so when one speaks the others are
placed again — without it a seat keeps showing somebody the list no longer
holds, above all in a picker's popup, where the façade never echoes the value
back down. What follows:

- **the group's value is the view that carries the MOST.** Four seats say who
  plays AND who sits where, a list of who plays says half of that: make the
  seating the value and derive the list (`value.filter(Boolean)`). Between two
  views of one answer, the value is the one the other can be computed from;
- **the Map names EVERY child**, the derived view included (one it does not name
  is left where it is: "the list never fills"), and **by name** — "every child
  except the list" also collects the search box the popup holds;
- **a gesture that moves two children never leaves the value in an
  in-between.** A drag from one seat to another is two writes, and the group
  aggregates between them: for an instant the person is in no seat, and is
  dropped. Write the group's value once, both seats already moved; or, when the
  seats must stay separate signals, write the destination first (two seats for
  an instant, never none) — source-first loses them silently. A signal `batch()`
  does NOT help: the group aggregates on each child's change, not on the render;
- **an in-between that cannot be avoided** (two people swapping seats) is not
  published: an aggregate returning what the group already holds says "not
  yet" — nothing is placed or handed up, and the next assembly publishes the
  whole answer. Returning `undefined` says "there is no answer", and wipes the
  row.

```jsx
// the seats are found by name, never as "everything that is not the list"
const seatChildren = (children) =>
  SEAT_NAMES.map((name) => children.find((child) => child.name === name));

// the value IS the seating; the list is a view of it
<ControlGroup
  aggregateChildStates={(children) => {…}}   // seats, minus who the list dropped, plus who it added
  distributeChildStates={(slots, children) =>
    new Map([
      ...seats.map((seat, i) => [seat, slots[i]]),
      [list, slots.filter(Boolean)],
    ])
  }
>
```

```js
// and a drag is one write
const moveTo = (from, to) => {
  const slots = [...rowSignal.value];
  slots[to] = slots[from];
  slots[from] = undefined;
  rowSignal.value = slots;
};
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
(`{ ...value.level, ...value.hours }`): a picker with no name of its own could
not be collected, and one merging its keys into the object around it would take
the row's identity away — nothing would say which row a key came from, nor which
row to put an incoming value back on. A `<ControlGroup>` with no name IS that
merge, for the case where there is no row: several controls in one screen, no
door between them.

## A settings sheet

A popup that is not one choice but a handful of settings — four tabs, a select,
a field, a button that answers with a place — and ONE answer, which must reach
the app only when the popup closes: the list behind it must not move while it is
open, and Escape must leave things exactly as they were found. It is the object
picker above, with the group in its popup: a picker's `action` runs on close and
only on close (its `uiAction` follows every gesture, which is what the popup
shows).

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
// `save` receives, on close and once:
// { origin: "city", city: "Antibes", radius: "30", department: "" }
```

**Which tab is showing is part of the answer**: the same fields mean different
things depending on the tab they were filled on. A tab bar is a navigation
(`<Nav slideContainer>` + `<Link slide>`), not a field, so the current area
reaches the value through an `<Input type="hidden">` bound to the container's
signal (a tab bar made of radios is a field already). That signal is written
both ways — a value handed DOWN writes it too, on open and when Escape puts back
what the picker held — so the sheet reopens on the tab of the answer, not on the
one being tried.

**Every field answers**, including those on another tab: they stay mounted and
come back in the object, and whoever receives it reads `origin` to know which
count. Aggregating the sheet to a single value of its own
(`aggregateChildStates`) throws away what makes the answer readable, starting
with the tab. **A button inside is not a field**: the one asking for a position
acts on the press, and what it answers goes into a control that IS one (a
read-only field showing the place found).

The façade reads the app's own state (`value={zone}` + a `ui` rendered from
`zone`) while the picker holds the draft, so the summary behind the open dialog
shows the answer, not the attempt. Demo:
`control/demos/picker/9_picker_settings_sheet_demo.html`.

## `Group` is not `ControlGroup`

`<Group>` is about the **frame** — several controls reading as one object to the
eye ([group.md](./group.md)); `<ControlGroup>` is about the **value**. They
compose, and either can exist without the other.

## See also

- [form_changed.md](./form_changed.md) — what a form sends, and what it measures
  against
- [control_value.md](./control_value.md) — who holds a single control's value
- [group.md](./group.md) — the visual `<Group>`
