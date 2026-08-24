# Who holds a control's value

Nobody, a signal, or you. Every control answers one of those three, and which
one it is decides what happens when the value moves — from a gesture, or from
somewhere else in the app.

- [The three answers](#the-three-answers)
- [A bound signal works in both directions](#a-bound-signal-works-in-both-directions)
- [`signal` + `defaultValue`: the answer and where it starts](#signal--defaultvalue-the-answer-and-where-it-starts)
- [What a signal holds, control by control](#what-a-signal-holds-control-by-control)
- [Which controls take a `signal`](#which-controls-take-a-signal)
- [`value` and `signal` exclude each other](#value-and-signal-exclude-each-other)
- [A `stateSignal` brings more than a value](#a-statesignal-brings-more-than-a-value)

## The three answers

| what you pass          | who holds the value | when the user acts                          |
| ---------------------- | ------------------- | ------------------------------------------- |
| nothing                | the control         | it keeps it; `uiAction` tells you           |
| `defaultValue`         | the control         | same — the default is only where it starts  |
| `signal`               | the signal          | the control writes it back, both ways       |
| `value` (or `checked`) | you                 | nothing moves until you hand a new one down |

A control given `value` and nothing to listen to it (`uiAction`, `action`, a
`signal`, a surrounding form) is read-only, and says so in dev: it is showing
something nobody can change.

## A bound signal works in both directions

This is the part that does not show in a call site: `signal` is not a seed. The
control writes every change into it, **and follows it when something else
writes it**.

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
back what it held when Escape cancels. The signal mirrors the control, so it
always says where the control actually is — which is what lets a settings sheet
reopen on the tab it was left on (see
[control_object.md](./control_object.md#a-settings-sheet)). What it does NOT
mirror is a picker's popup being played with: a picker's own signal is written
when the picker commits, on close.

Both halves are worth knowing about, because each replaces a habit:

- the write-back replaces `uiAction={(v) => (mySignal.value = v)}`;
- the follow replaces the `key` or the `value`/`uiAction` pair used to push an
  outside change into a control.

The follow goes all the way up: a bound control that lives inside a group — two
wheels in a `WheelGroup`, a field in a `ControlGroup` — makes that group
re-aggregate when its signal is written, and the form above sees the new value.
A shortcut that pushes the controls from the outside is an answer like any
other: the wheels roll, and the submit lights up.

```jsx
<Button
  onClick={() => {
    hoursSignal.value = 2;
    minutesSignal.value = 0;
  }}
>
  2h
</Button>
```

## `signal` + `defaultValue`: the answer and where it starts

They are not competing, they answer two different questions:

- the **signal** is the answer, when it holds one;
- `defaultValue` is where the control starts, and where a reset goes back to.

```jsx
// "how many players" is what my account usually answers, unless this game says
// otherwise — no `??` to write, and no first render showing the wrong one
<List selectable signal={gameLevelsSignal} defaultValue={me.levels}>
```

An emptied signal (`signal.value = undefined`) puts the control back on its
default rather than leaving it blank — which is what makes "nothing decided
here, use the usual answer" expressible at all. Without a `defaultValue`, an
emptied signal empties the control.

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
the signal, not one item's value — its children put it together between them.

A `<Form>` (or a `<ControlGroup>`) takes one the same way, holding the whole
object: its named children are filled from it, they move when something else
writes it, and what they change is written back into it. One signal for a screen
whose values arrive together — see
[create_and_edit.md](./create_and_edit.md#two-screens-two-states).

## Which controls take a `signal`

All of them: `Input` (every type), `Picker`, `Select`, `Wheel`, `Spin`,
`List selectable` (single and multiple), and control groups in general. Anything
that is a navi control goes through the same state controller, and the same
`signal` prop.

`SlideContainer` takes one too, though it is layout rather than a control: the
area it shows is a piece of state like any other, and binding it is what lets
something else read where the slides are — or move them by writing it.

Inside a `List selectable` you can bind the list, or give each `List.Item` its
own `selected` — but not expect the two to arbitrate. An item that declares
`selected` is answering for itself, and the list's signal does not reposition
it.

## `value` and `signal` exclude each other

`value` (or `checked`) says "you hold it", `signal` says "the signal holds it".
Passing both is a call site to fix: **the signal wins and the other prop is
ignored** — on a leaf control as on a group (a selectable list, a checkbox
group) — and navi says so in dev. One owner, whichever half of the binding you
look at.

Replacing `value` with `signal` also means dropping the `uiAction` that used to
write the signal by hand — it is exactly what the binding now does. Keep
`uiAction` only for what is not "remember the value": logging, a side effect,
something else moving with it.

## A `stateSignal` brings more than a value

A plain signal (`useSignal`, `signal()`) is enough to bind a control. A
`stateSignal` also carries its own `options`, and a control reads them so it
does not have to be told twice: `type` (which decides the input type and the
validation messages), `min`, `max`, `step`, and its **default**, which seeds
`defaultValue`/`defaultChecked` — so a reset goes back to the signal's original
default rather than to whatever it happened to hold at the last render.

That is the only difference. A plain signal binds the same way in both
directions; it just has nothing extra to say.

## See also

- [form_changed.md](./form_changed.md) — what a form makes of each of these:
  which fields it counts as already answered, and when it sends nothing
- [control_object.md](./control_object.md) — several controls reading as one
  object: which group aggregates them, and how the value travels down by name
- [control_group.md](./control_group.md) — several controls reading as one
  framed object
- [actions.md](./actions.md#action-or-uiaction) — `action` or `uiAction`: which
  one carries loading and error, and which one carries nothing
- [popup_open.md](./popup_open.md#escape-cancels-the-other-gestures-keep) — what
  a cancelled popup does to the value inside it
