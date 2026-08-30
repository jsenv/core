# Bound, not wired

Every piece of state navi shows already has a way in and a way out: the value in
a control, the area a `SlideContainer` stands on, whether a popup is open, where
the user is in the application. A callback whose whole body copies that state
into a variable of your own is a second road beside one that exists — and from
then on there are two owners for one truth.

- [The three shapes](#the-three-shapes)
- [The callback that only remembers](#the-callback-that-only-remembers)
- [Why it is not merely shorter](#why-it-is-not-merely-shorter)
- [What is left for the callback](#what-is-left-for-the-callback)
- [What binds itself](#what-binds-itself)
- [When there is no binding](#when-there-is-no-binding)

## The three shapes

Almost everything an application has to say about a component is one of three
things, and each has its own prop:

| what the code has to say                      | how it is said                             |
| --------------------------------------------- | ------------------------------------------ |
| this state is the app's, both ways            | `signal`                                   |
| something HAPPENS when it changes             | `action` (`uiAction` for what cannot fail) |
| a press asks something of a component near it | `command` + `commandFor`                   |

Reaching for a handler that is none of the three — an `onClick`, an
`onCurrentChange`, a `uiAction` writing a signal — is the sign that one of them
was missed.

## The callback that only remembers

The same mistake, in four places:

```jsx
// ✗ the app is told where the slides went, and writes it back down
<SlideContainer
  current={step}
  onCurrentChange={(area) => {
    stepSignal.value = area;
  }}
/>
// ✓
<SlideContainer signal={stepSignal} />

// ✗ the control is told what it now holds, and the app writes it back down
<Picker value={side} uiAction={(value) => (sideSignal.value = value)} />
// ✓
<Picker signal={sideSignal} />

// ✗ a button proposing a value to a control, straight into the signal
<Button onClick={() => (durationSignal.value = ninetyMinutes)}>1h30</Button>
// ✓
<Button command="--navi-update" commandFor="duration" value={ninetyMinutes}>
  1h30
</Button>

// ✗ the popup is told it opened, and the app writes it back down
<Dialog
  open={isOpen}
  onOpen={() => (openSignal.value = true)}
  onClose={() => (openSignal.value = false)}
/>
// ✓
<Dialog signal={openSignal} />
```

In each pair the second line is not a tidier spelling of the first: it is the
binding the component already implements, and the first is a partial
re-implementation of it.

## Why it is not merely shorter

A binding is written by **everything that moves the state**, not only by the
gesture the caller thought of. A `SlideContainer`'s signal is written by a drag,
by an arrow key, by a `--navi-right` command sent from a chevron outside the
box, by the address when the signal is a route's own, by a step refusing to be
left. A control's
signal is written by the user typing, by a group placing its children, by a
picker committing on close, by a `--navi-update` from a shortcut button. A
hand-written callback catches the cases it was written for and silently misses
the rest — and the drift only shows on the screen where a second gesture was
added.

It reads in the other direction too, which no callback gives at all: writing the
signal MOVES the component. The wheels roll, the slides travel, the popup opens.
That is what replaces the `key` or the `value` prop pushed down to force a
component into a state.

And it goes through navi's interaction gate. A `command` on a read-only,
disabled or busy control is refused and says why; an `onClick` doing the same
write is plain DOM, fires on a greyed-out button and rewrites a value nobody was
allowed to change.

## What is left for the callback

Binding the state does not remove the callback — it removes one job from it:

- **`onCurrentChange` with a `signal` bound still fires**, and is still worth
  writing: `cause` says whether the slide was pressed, dragged, or asked for by
  the address — which is what tells a history push from a replace — and
  returning `false` REFUSES the travel. Neither of those is state.
- **`uiAction`** is for what moves with the value without being it: logging,
  something else on screen following along. Not "remember it".
- **`action`** is for what can fail or take time — it carries the busy state and
  the error, which a `uiAction` does not (see
  [actions.md](./actions.md#action-or-uiaction)).
- **`onClick`** is for imperative work with nothing to send, nothing to open and
  nothing to propose.

## What binds itself

| the state                         | how it binds                               | where it is written up                                                                 |
| --------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| a control's value                 | `signal` (every control, every group)      | [control_value.md](./control_value.md)                                                 |
| the area a `SlideContainer` is on | `signal` (a route's, and it is in the URL) | its JSDoc, [navigation.md](./navigation.md)                                            |
| a popup being open                | `signal`, `open`, `navState`               | [popup_open.md](./popup_open.md)                                                       |
| where the user is                 | route + search-param signals               | [navigation.md](./navigation.md)                                                       |
| a value proposed to a control     | `command="--navi-update"`                  | [control_value.md](./control_value.md#a-button-that-proposes-a-value-is---navi-update) |
| the state of an async run         | an `action`, read by `useAsyncData`        | [actions.md](./actions.md)                                                             |

## When there is no binding

Sometimes the state being wired by hand has no prop for it. That is not a
licence to wire it — it is a finding, and it is one of two:

- the state is already held somewhere and the app is keeping a parallel copy of
  it (the URL, the control itself, an action's own state) — the fix is to read
  it where it lives;
- or navi is genuinely missing a binding, and should gain one.

Say which, rather than leaving a hand-wired callback behind: it is the version
the next screen copies, and by then it is the app's pattern.

## See also

- [control_value.md](./control_value.md) — who holds a control's value, and what
  a bound signal holds control by control
- [actions.md](./actions.md#action-or-uiaction) — `action` or `uiAction`
- [popup_open.md](./popup_open.md) — who owns the fact that a popup is open
- [interactions.md](./interactions.md) — a gesture is named, not read by hand:
  the same rule, one layer down
