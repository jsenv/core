# Who holds a control's value

Nobody, a signal, or you. Every control answers one of those three, and which
one it is decides what happens when the value moves — from a gesture, or from
somewhere else in the app.

- [The three answers](#the-three-answers)
- [A bound signal works in both directions](#a-bound-signal-works-in-both-directions)
- [A picker fills its popup: the control inside already knows](#a-picker-fills-its-popup-the-control-inside-already-knows)
- [A button that proposes a value is `--navi-update`](#a-button-that-proposes-a-value-is---navi-update)
  - [`--navi-update:smooth`: the control is seen answering](#--navi-updatesmooth-the-control-is-seen-answering)
- [`signal` + `defaultValue`: the answer and where it starts](#signal--defaultvalue-the-answer-and-where-it-starts)
- [A `defaultValue` follows what it was read from](#a-defaultvalue-follows-what-it-was-read-from)
- [Drawing what a control holds](#drawing-what-a-control-holds)
- [What a signal holds, control by control](#what-a-signal-holds-control-by-control)
- [Empty keeps the shape of the question](#empty-keeps-the-shape-of-the-question)
- [What a checkbox is worth](#what-a-checkbox-is-worth)
- [Which controls take a `signal`](#which-controls-take-a-signal)
- [The PROP is what controls, not its value](#the-prop-is-what-controls-not-its-value)
- [A yes/no shown as two rows](#a-yesno-shown-as-two-rows)
- [Clearing, resetting, and what is shown meanwhile](#clearing-resetting-and-what-is-shown-meanwhile)
- [`value` and `signal` exclude each other](#value-and-signal-exclude-each-other)
- [A `stateSignal` brings more than a value](#a-statesignal-brings-more-than-a-value)
- [A time of day: typed, or turned](#a-time-of-day-typed-or-turned)

## The three answers

| what you pass          | who holds the value | when the user acts                                                                    |
| ---------------------- | ------------------- | ------------------------------------------------------------------------------------- |
| nothing                | the control         | it keeps it; `uiAction` tells you                                                     |
| `defaultValue`         | the control         | same — the default is where it starts, and a new one is taken while nothing is edited |
| `signal`               | the signal          | the control writes it back, both ways                                                 |
| `value` (or `checked`) | you                 | nothing moves until you hand a new one down                                           |

A control given `value` and nothing to listen to it (`uiAction`, `action`, a
`signal`, a surrounding form) is read-only, and says so in dev: it is showing
something nobody can change.

## A bound signal works in both directions

`signal` is not a seed. The control writes every change into it, **and follows
it when something else writes it**:

```jsx
const minutesSignal = useSignal(0);

<Wheel type="integer" signal={minutesSignal}>
  {MINUTES.map((m) => (
    <Wheel.Item key={m} value={m}>
      {pad2(m)}
    </Wheel.Item>
  ))}
</Wheel>;

// elsewhere — the wheel rolls to 30, no re-render of your own needed
minutesSignal.value = 30;
```

"Every change" includes the ones the control did not decide: a group placing
its children, a picker filling its popup at open, and the same picker putting
back what it held when Escape cancels. So the signal always says where the
control actually is — which is what lets a settings sheet reopen on the tab it
was left on ([control_object.md](./control_object.md#a-settings-sheet)). A
picker's own signal follows its popup the same way, gesture by gesture, and so
does its `uiAction`. What waits for the close is the picker's `action` — and a
suggestion nobody touched, which becomes the answer when the popup closes on it.

The write-back replaces the `uiAction` that copies the value into a signal:

```jsx
// ✗ the control is told what it now holds, and the app writes it back down
<Picker value={side} uiAction={(value) => (sideSignal.value = value)} />
// ✓
<Picker signal={sideSignal} />
```

The follow goes all the way up: a bound control inside a group — two wheels in
a `WheelGroup`, a field in a `ControlGroup` — makes that group re-aggregate when
its signal is written, and the form above sees the new value: the wheels roll,
and the submit lights up. Which is why a **button** offering such a value is not
a hand-written signal write — see
[below](#a-button-that-proposes-a-value-is---navi-update).

## A picker fills its popup: the control inside already knows

A picker mirrors the control in its popup, both ways
([popup_open.md](./popup_open.md#composing-a-value-or-doing-work)), and the
first half happens **at open**: the picker fills the control with the value it
holds, before anything is shown.

```jsx
// the row matching the picker's value is already selected, painted and
// announced — nothing here says which one it is
<Picker id="channel" signal={channelSignal}>
  <List selectable>
    {CHANNELS.map((channel) => (
      <List.Item key={channel.id} value={channel.id}>
        {channel.label}
      </List.Item>
    ))}
  </List>
</Picker>
```

So a `current`, a `selected` per row, or a `value` computed from what the picker
holds is not "being explicit": it is a second answer to a question already
answered, and the one that goes stale — the picker's value moves on a cancel, a
`--navi-update`, a signal written elsewhere, and none of those pass through that
prop. The list marks the selected row itself (`aria-selected`); anything extra
hangs off that marker in CSS.

## A button that proposes a value is `--navi-update`

A shortcut beside a control — "Tous niveaux" next to a list of levels, "1h /
1h30 / 2h" next to a pair of wheels, a suggestion under a field — is a value
offered to that control. It is not an action, and not a signal to write by hand:

```jsx
<WheelGroup id="duration" signal={durationSignal}>
  <Wheel name="hours">…</Wheel>
  <Wheel name="minutes">…</Wheel>
</WheelGroup>

<Button
  command="--navi-update"
  commandFor="duration"
  value={{ hours: 1, minutes: 30 }}
>
  1h30
</Button>
```

- the **value** is the button's own `value`, whatever its shape — a string, an
  array of levels, an object of two wheels;
- the **target** is `commandFor`, naming the control's id — left out, the
  nearest control around the button, which is what a button placed inside the
  control it proposes to wants;
- the press goes through the same gate as every other interaction, so a
  read-only, disabled or busy control **refuses it and says why**.

That last point is the reason, and the counter-example is what everybody writes
first:

```jsx
// ✗ not gated — plain DOM. On a read-only sheet the button greys out and fires
//   all the same, rewriting a value nobody is allowed to change.
<Button onClick={() => (durationSignal.value = { hours: 1, minutes: 30 })}>
  1h30
</Button>
```

Writing a signal from an `onClick` is only right where nothing is being proposed
to a control: moving something else on screen, seeding state before anything is
drawn.

The id goes **on the control**, and a group is one — `ControlGroup`, `Form`,
`WheelGroup`, `List selectable`. Put on a layout box around the control, the
command finds an element that holds no value, and navi says so in dev rather
than letting the press do nothing; an id that matches nothing is a dev warning
too, naming the id it looked for.

### `--navi-update:smooth`: the control is seen answering

On a phone the thumb covers the shortcut while the eye is on the control, and a
value swapped at once shows neither which control changed nor by how much.
`:smooth` asks for the control to be seen moving to the value, the way it moves
under a finger:

```jsx
<Button command="--navi-update:smooth" commandFor={hoursId} value={evening}>
  soir
</Button>
```

- **The control decides how it moves, and when the value lands.** A wheel takes
  the value at once — whoever reads the control right after the press (a form,
  `--navi-send`, a signal) gets it — and glides to the row, the short way round
  when it loops. A spin plays the one travel a chevron would play, whatever the
  distance, and the value lands with the slides (`duration`, 250 ms by
  default); a value past `min`/`max` is refused the way that chevron refuses
  it, and left alone. An `editable` spin (a `NumberSpin`, so a `TimeSpin`) is a
  field, and nothing travels around a field: the value is swapped in place. A
  control that does not know the argument answers like a plain `--navi-update`.
- **A gesture on the control itself is never fought.** A wheel being dragged or
  flung keeps reporting its own rows, and goes to the requested value once the
  finger's movement is over. A value a wheel merely caught up with is not a
  choice: it fires no settle, no `action`. A spin's landing IS the answer being
  given, so it tells `uiAction`, with the press that asked for it.
- **`prefers-reduced-motion` keeps the instant swap**: whoever asked to see less
  motion is answered first.

From JS, for what is not a button:
`dispatchRequestSetUIState(el, value, { behavior: "smooth" })` — sent to a
group such as `TimeRangeWheel`, it reaches each of its wheels.

## `signal` + `defaultValue`: the answer and where it starts

They are not competing, they answer two different questions:

- the **signal** is the answer, when it holds one;
- `defaultValue` is where the control starts, and where a reset goes back to.

```jsx
// "which levels" is what my account usually answers, unless this game says
// otherwise — no `??` to write, and no first render showing the wrong one
<List selectable multiple signal={gameLevelsSignal} defaultValue={me.levels}>
```

An emptied signal (`signal.value = undefined`) puts the control back on its
default rather than leaving it blank — which is what makes "nothing decided
here, use the usual answer" expressible at all. Without a `defaultValue`, an
emptied signal empties the control.

## A `defaultValue` follows what it was read from

A field editing a record starts on that record, `defaultValue={user.first_name}`,
and the record moves after mount: the save comes back normalized (a trailing
space trimmed), another screen or device changed it, a refresh arrived. The
control takes the new default **while it holds no edit** — nothing typed, picked
or toggled since the value the outside last accepted. An edit is never undone:
the default waits, and lands once that edit is accepted (the action succeeded)
or taken back (the action failed, the popup was cancelled).

This holds for a control, for a group given a `defaultValue` (a selectable list,
a `ControlGroup`), and for everything inside a picker's popup, which stays
mounted while closed. So the record goes in as `defaultValue` and nothing else —
no `key` to remount the popup when it changes: a key also destroys whatever is
being typed when the answer to ANOTHER field arrives. A picker's cancel follows
the same line: it undoes the person's edits
([popup_open.md](./popup_open.md#what-cancel-actually-undoes)), and what the
outside moved during the opening stays moved.

## Drawing what a control holds

A picker's trigger usually shows the choice (a label for a code, a summary of
an object). Read it from the picker rather than keeping a copy:

```jsx
// a `ui` component is handed `value`, `loading` and `interactive`;
// a `ui` element reads the same three with usePickerState()
const VisibilityLabel = ({ value }) => <Text>{labelOf(value)}</Text>;

<Picker name="visibility" defaultValue={user.visibility} ui={VisibilityLabel}>
  …
</Picker>;
```

What not to write: `const s = useSignal(defaultValue)` bound as `signal={s}`,
just to have something to read. `useSignal` reads its argument once, so the
signal never hears the record move, and a bound signal takes precedence over the
control's own `defaultValue`: the field is stuck on its first value. A signal is
for a value the app owns and writes itself (a url param, state shared between
screens), not a mirror kept for drawing.

## What a signal holds, control by control

The signal holds what the control is ABOUT, which is not always its `value`
attribute:

| control                                                       | what the signal holds             |
| ------------------------------------------------------------- | --------------------------------- |
| text/number/date `Input`, `Wheel`, `Spin`, `Picker`, `Select` | the value itself                  |
| checkbox, radio                                               | a boolean — whether it is checked |
| `List selectable`                                             | the selected value                |
| `List selectable multiple`, checkbox group                    | the array of selected values      |

A group (a selectable list, a checkbox group) writes its whole selection into
the signal, which its children put together between them. A `<Form>` (or a
`<ControlGroup>`) takes one the same way, holding the whole object: its named
children are filled from it, move when something else writes it, and write back
what they change. One signal for a screen whose values arrive together and where
no field needs a url of its own — the fields then take nothing but their `name`
(see [create_and_edit.md](./create_and_edit.md#two-screens-two-states)).

## Empty keeps the shape of the question

What a control is worth when it holds nothing has the type of what it holds when
it holds something. A list of days nobody picked is `[]`, not `""`:

| control                                           | empty is |
| ------------------------------------------------- | -------- |
| `Picker type="array"`, `List selectable multiple` | `[]`     |
| `Picker type="object"`                            | `{}`     |
| text/number/date `Input`, `Select`                | `""`     |
| `Input type="checkbox" boolean`                   | `false`  |
| radio, any other checkbox                         | absent   |

This is what a clear (`--navi-clear`, a row's cross) leaves behind and what the
object around it carries, so `value.days || []` is not needed.

## What a checkbox is worth

A checkbox answers the way HTML's does: checked it carries its `value`,
unchecked it carries nothing. `boolean` makes it a yes/no instead:

| checkbox       | checked  | unchecked   |
| -------------- | -------- | ----------- |
| no `value`     | `"on"`   | `undefined` |
| `value="toto"` | `"toto"` | `undefined` |
| `value={true}` | `true`   | `undefined` |
| `boolean`      | `true`   | `false`     |

That is what it hands everywhere: to its own `action` and `uiAction`, and to
the form or group around it. Only a bound `signal` differs: it holds whether the
box is checked, a boolean in every row above.

Choose by what the box asks:

- **A yes/no** (a setting, a consent, a favourite) is `boolean`. Unchecked has
  to say "no", and `undefined` says nothing: `{ favourite: undefined }` is sent
  as `{}`, the server changes nothing, and the box shows a "no" nobody
  accepted.
- **A member of a set** (several checkboxes sharing a `name`, each adding its
  value) takes its own `value`, or none for `"on"`. Unchecked carries nothing,
  so the group gathers only the checked ones into an array.

## Which controls take a `signal`

All of them: `Input` (every type), `Picker`, `Select`, `Wheel`, `Spin`,
`List selectable` (single and multiple), and control groups in general — they
go through the same state controller. `SlideContainer` takes one too, for the
area it shows (see
[navigation.md](./navigation.md#a-slidecontainer-in-the-url-a-position-that-is-not-a-place-one-came-from)).

Inside a `List selectable` you can bind the list, or give each `List.Item` its
own `selected` — but not expect the two to arbitrate. An item that declares
`selected` is answering for itself, and the list's signal does not reposition
it: a list where clicking does nothing. navi says it in dev the moment the two
claims meet — bind one end or the other, not both.

## The PROP is what controls, not its value

`value` (and `checked`, and a row's `selected`) makes a control controlled by
being **there**. Its value is a separate question: `value={undefined}` says "I
hold this one, and right now it holds nothing" — the control shows nothing, and
nothing else can fill it. That is a real state and it is the one asked for.

The trap is the shorthand for an optional prop:

```jsx
// WRONG — the key is always there, so the control is always controlled,
// and the group above it can never fill it
<Input checked={bound ? undefined : checked} />

// RIGHT — the prop is there only when you are the one answering
<Input {...(bound ? {} : { checked })} />
```

Passing a prop the code knows will always be `undefined` is the same mistake
written once instead of twice: leave it out. navi says so in dev when a group
tries to place a child that has claimed itself this way.

## A yes/no shown as two rows

A checkbox is one way to ask a yes/no; two rows one can compare — "Publique" and
"Privée", each with the sentence that tells them apart — is another, and it is
the same value:

```jsx
<Picker name="visibility" signal={isPublicSignal}>
  <List selectable>
    <List.Item value={true}>Publique …</List.Item>
    <List.Item value={false}>Privée …</List.Item>
  </List>
</Picker>
```

Nothing translates: the row holds the boolean, the form carries the boolean.
What cannot be done is give a row `undefined` to mean "no value" — `undefined`
is what UNCHECKED means, here as in HTML, so such a row can never be ticked.
"Nothing chosen" is the absence of a row, not a row.

## Clearing, resetting, and what is shown meanwhile

Three things that look alike and are not:

| gesture / prop            | what it does                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `--navi-clear`, the cross | the control holds its own empty — `""`, `[]`, `{}`, unchecked                       |
| `--navi-reset`            | the control goes back to its `defaultValue`                                         |
| `defaultValue`            | where it starts, and where a reset goes back to — a real value, sent like any other |
| `placeholder`             | what is SHOWN while it holds nothing, and never a value                             |

So a row whose cross means "back to the one from my profile" needs nothing of
its own: clearing empties it, and `placeholder` is where that sentence is
written. The app then reads `undefined` (or the empty of the row's type), which
is what "nothing chosen here, use the usual answer" means everywhere else.

```jsx
<Picker clearable placeholder="Celui de mon profil" signal={sideSignal} />
```

A control that cannot show emptiness — a pair of wheels has no blank row to land
on — takes the same `placeholder` as a POSITION instead of a word (see
`TimeWheel`): shown, and still not an answer. A clear, or a value written as
`undefined`, puts it back on that position and back to answering nothing.

## `value` and `signal` exclude each other

`value` (or `checked`) says "you hold it", `signal` says "the signal holds it".
Passing both is a call site to fix: **the signal wins and the other prop is
ignored** — on a leaf control as on a group (a selectable list, a checkbox
group) — and navi says so in dev. What is left for a `uiAction` once the signal
is bound: [state_binding.md](./state_binding.md#what-is-left-for-the-callback).

## A `stateSignal` brings more than a value

A plain signal (`useSignal`, `signal()`) is enough to bind a control, both ways.
A `stateSignal` also carries its own `options`, and a control reads them so it
does not have to be told twice: `type` (which decides the input type and the
validation messages), `min`, `max`, `step`, and its **default**, which seeds
`defaultValue`/`defaultChecked` — so a reset goes back to the signal's original
default rather than to whatever it happened to hold at the last render.

## A time of day: typed, or turned

`TimeSpin`/`TimeRangeSpin` are fields one types in, `TimeWheel`/`TimeRangeWheel`
are wheels one turns; both carry a single `"HH:MM"` (or `{ start, end }` for a
span), so a form holds one field either way. Prefer the wheels whenever a
half-written value would be nonsense: a time typed digit by digit goes through
states that are not times ("1" on its way to "18"), while a wheel only ever
shows values that exist. Only the wheels push the bounds of a span apart as they
turn (`minDuration`, which the spins check at send) and take a `placeholder` as
a position. Their props are in their JSDoc
(`src/control/picker/preset/spin_time.jsx`, `src/control/wheel/wheel_time.jsx`).

## See also

- [state_binding.md](./state_binding.md) — the same rule beyond controls
- [form_changed.md](./form_changed.md) — which fields a form counts as already
  answered, and when it sends nothing
- [control_object.md](./control_object.md) — several controls answering one
  object
- [group.md](./group.md) — several controls drawn as one frame
- [actions.md](./actions.md#action-or-uiaction) — `action` or `uiAction`
