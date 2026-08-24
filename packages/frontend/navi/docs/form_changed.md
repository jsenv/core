# What a form sends, and what it measures against

A form answers a question. Asked again with the same answer, it has nothing to
say — so by default **a `<Form>` sends nothing when nothing changed**. This is
the whole subject of this file: what "changed" is measured against, what counts
as an answer the form already holds, and what to do on a screen whose fields are
filled a request later.

- [Sending nothing is the default](#sending-nothing-is-the-default)
- [What follows a send](#what-follows-a-send)
- [What the form is measured against](#what-the-form-is-measured-against)
- [What counts as already held](#what-counts-as-already-held)
- [A screen filled after it opened: `pristineKey`](#a-screen-filled-after-it-opened-pristinekey)
- [A submit that says it is waiting](#a-submit-that-says-it-is-waiting)
- [A control that is not a field](#a-control-that-is-not-a-field)

## Sending nothing is the default

Submitting a form nobody touched — one just rendered, one whose fields still
hold their defaults, one reopened and left alone — runs **no action**. No
request, nothing in the network tab.

Everything around the action still happens: the constraints are checked, and
what follows the send still follows it (the popup closes, the slide moves on).
The user is done either way; there was simply nothing to send.

`canSendWhileUnchanged` turns that off, for a form where sending the same thing
twice is the point — a single button firing a notification, an action whose
duplicates are fine.

```jsx
<Form action={notify} canSendWhileUnchanged>
```

## What follows a send

The form has answered its question; `command` says what the screen does about
it — dismiss the popup (`--navi-close`), move on the slide map
(`--navi-left`…), go to a page (`--navi-nav-to:/games/42`), stay put
(`--navi-void`). Left out, the surface the form sits in decides: a popup closes,
a slide goes on, a form on a page does nothing.

It runs **whether or not there was anything to send** — that is the other half
of the rule above: the person is done either way, and a submit that ran no
action still closes the popup, still moves on, still navigates. Which is why
this is a prop, decided before the send: the form has to know where it goes even
when nothing happened.

Nothing runs when the send fails, or when a constraint refuses it. The form then
stays in front of the person, showing what it is waiting for.

### When only the response knows where to go

A creation lands on the page the server just made, and its id comes back with
the response — too late for a prop. Do it in the action, which is where the
answer is:

```jsx
<Form
  action={async (value) => {
    const game = await createGame(value);
    navTo(`/games/${game.id}`);
  }}
>
```

Nothing to declare: a creation always has something to send, so there is no
"the press did nothing" case for `command` to cover.

If you would rather it go through the command machinery all the same (to reuse
whatever a command does on that surface), the form carries what follows the send
as `data-after-send`, read once the send has succeeded — so an action can write
it while it runs:

```js
formRef.current.setAttribute("data-after-send", `--navi-nav-to:/games/${id}`);
```

## What the form is measured against

One value, called the baseline here: **what the form held the last time it had
nothing to say.**

- taken once the fields have registered — the earliest moment the form knows
  what it holds;
- taken again after every **successful** send, so the next submit is measured
  against what was just sent (a send that failed changes nothing: the same
  value must remain sendable);
- never taken again on its own. A form does not notice that its fields were
  filled from the outside — see `pristineKey` below.

Fields holding nothing are left out on both sides. Whether an empty field is
absent or present-and-empty depends on when it registered, and comparing those
would make an untouched form look changed.

## What counts as already held

This is the part that decides everything, and the one that surprises: a field
can be **named, filled, and still not part of the baseline**.

| what the field was given                      | held? |
| --------------------------------------------- | ----- |
| `value`                                       | yes   |
| `signal` carrying something                   | yes   |
| `signal` that is empty                        | no    |
| `defaultValue` (and the field still shows it) | no    |
| `defaultValue`, moved away from it            | yes   |
| nothing                                       | no    |

The rule behind the table: **a value is an answer, a default is a suggestion.**
An age that is usually 18, a duration that is usually 1h30 — the form holds
nothing there, and confirming the suggestion IS an answer ("yes, 18"), which
must be sendable. A bound signal falls on whichever side its content puts it: a
signal restored from the url or set by whoever fills the screen carries an
answer, even when the signal also declares a default (its default only says
where a reset goes back to).

The same question is asked of a single control by `isUIStateHeld`
(`src/control/held_ui_state.js`) — a form asks it once per field.

## A screen filled after it opened: `pristineKey`

The baseline is taken as soon as the fields have registered, which is right for
a form whose values are there on the first render — and wrong for a screen that
modifies something: the resource arrives a request later and fills the fields,
so a form measured against what it held BEFORE that opens **already changed**.
Its submit is live, and pressing it sends back the resource untouched.

`pristineKey` takes the baseline again. Pass whatever says the filling is done:

```jsx
<Form pristineKey={game && players && places ? "loaded" : undefined}>
```

Change it **once**, when the screen is ready. Taken again after someone started
typing, it would call what they wrote the reference.

No need to delay it by a tick: the reference is taken when the fields have
settled, and again at the end of that same tick — so a row that arrives in a
render of its own (a value computed from signals, a memoized row) is part of it
without the screen having to know which of its fields settle late.

Do not use a `key` on the `<Form>` for this: it remounts every control and every
popup inside it, and anything half-typed goes with them.

## A submit that says it is waiting

By default a submit that sends nothing is still accepted — in a dialog or a
slide it closes / moves on all the same. In a form that goes nowhere on its own,
the press would visibly do nothing; `readOnlyWhileFormUnchanged` on the button
holds it back and says what it is waiting for.

```jsx
<Button type="submit" readOnlyWhileFormUnchanged>
  Save
</Button>
```

## A control that is not a field

A control inside a form is expected to carry a value under its name, and a
nameless one is warned about — its state would silently stay out of what is
sent. A control that only opens something (a picker whose popup draws a shape, a
row whose value is carried by a hidden input beside it) says so with
`allowNameless`:

```jsx
<Picker allowNameless ui={…}>
```

It is then neither collected nor complained about — and inside a picker's popup
it is not the control the picker talks to either, which is what lets a search
box sit above the list that IS the answer (see
[control_object.md](./control_object.md#a-picker-whose-value-is-an-object)).

## See also

- [control_value.md](./control_value.md) — who holds a control's value:
  nothing, a bound `signal`, or you
- [control_object.md](./control_object.md) — one value made of several
  controls: `ControlGroup`, `Form`, and a picker whose value is an object
- [create_and_edit.md](./create_and_edit.md) — the create/edit loop this is
  half of: routes, the resource, and where each screen goes next
- [actions.md](./actions.md) — what an action does around the send itself
