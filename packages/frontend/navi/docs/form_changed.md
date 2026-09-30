# What a form sends, and what it measures against

A form answers a question. Asked again with the same answer, it has nothing to
say — so by default **a `<Form>` sends nothing when nothing changed**. This file
is about what "changed" is measured against, what counts as an answer the form
already holds, and what to do on a screen whose fields are filled a request
later.

- [Sending nothing is the default](#sending-nothing-is-the-default)
- [What follows a send](#what-follows-a-send)
- [What the form is measured against](#what-the-form-is-measured-against)
- [What counts as already held](#what-counts-as-already-held)
- [A screen filled after it opened: `pristineKey`](#a-screen-filled-after-it-opened-pristinekey)
- [A submit that says it is waiting](#a-submit-that-says-it-is-waiting)
- [A control that answers for itself](#a-control-that-answers-for-itself)

## Sending nothing is the default

Submitting a form nobody touched — one just rendered, one reopened and left
alone — runs **no action**. No request, nothing in the network tab. The
exception is a field still showing its `defaultValue`: confirming a suggestion
is an answer, sent once (see
[What counts as already held](#what-counts-as-already-held)).

Everything around the action still happens: the constraints are checked, and
what follows the send still follows it — the popup closes, the slide moves on,
the page changes. The user is done either way; there was simply nothing to
send.

`canSendWhileUnchanged` turns that off, for a form where sending the same thing
twice is the point — a single button firing a notification, an action whose
duplicates are fine.

```jsx
<Form action={notify} canSendWhileUnchanged>
```

## What follows a send

The form has answered its question; `command` says what the screen does about
it — `--navi-close`, `--navi-left`…, `--navi-nav-to:/games/42`,
`--navi-nav-back:/games` (back to the page the reader came from),
`--navi-reset` (empty itself and stay), `--navi-void` (stay put as it is). Left
out, the surface the form sits in decides: a popup closes, a slide goes on, a
form on a page does nothing. A submit button says its own with `formCommand`,
which wins over the form's: in a form with two ways out, "save" stays and
"delete" goes back to the list.

It is a prop, decided before the send, because it runs **whether or not there
was anything to send**. Nothing runs when the send fails, or when a constraint
refuses it: the form stays in front of the person, showing what it is waiting
for.

### A popup that stays open

A popup closes once a form inside it is sent. When it is a place one keeps
working in — a panel where a push is sent, two fields are fixed, an account is
linked — the form says it stays:

```jsx
<SidePanel signal={openUserSignal} value={user.id}>
  <Form action={sendPush} command="--navi-void">
    …
  </Form>
</SidePanel>
```

The form says it, not the popup: the same panel can hold a form edited in over
and over and a "delete" whose send has to close it, and the same content should
behave the same in a `SidePanel` or a `Dialog`.

When the popup's open state is a url param (`signal` bound to a route's search
param), closing it takes the param out of the url. A form that forgot
`--navi-void` then looks like a screen that reloaded: the panel is gone, and so
is what a reload would have brought back.

`--navi-reset` is the one to reach for when the form is a place one comes back
to — an entry created, then the next one: the fields go back to their
`defaultValue`. What the form is measured against stays what was just sent (see
below), so the emptied form reads as changed, and the fields' own constraints
are what keep an empty one from being sent.

```jsx
<Form action={createPlaceGroup} command="--navi-reset">
```

### When only the response knows where to go

A creation lands on the page the server just made, and its id comes back with
the response — too late for a prop. Do it in the action, which is where the
answer is (a creation always has something to send, so there is no "the press
did nothing" case for `command` to cover):

```jsx
<Form
  action={async (value) => {
    const game = await createGame(value);
    navTo(`/games/${game.id}`);
  }}
>
```

To go through the command machinery all the same (to reuse whatever a command
does on that surface), write it where the form keeps what follows the send,
`data-after-send`, read once the send has succeeded — an action can write it
while it runs:

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
answer. A `stateSignal` that declares a default is never empty — the default is
what it holds until something else is written, and what writing `undefined`
puts back — so its field counts as held from the start.

## A screen filled after it opened: `pristineKey`

The baseline taken as the fields register is right for a form whose values are
there on the first render — and wrong for a screen that modifies something: the
resource arrives a request later and fills the fields, so the form opens
**already changed**. Its submit is live, and pressing it sends back the resource
untouched.

`pristineKey` takes the baseline again. Pass whatever says the filling is done:

```jsx
<Form pristineKey={game && players && places ? "loaded" : undefined}>
```

Change it **once**, when the screen is ready: taken again after someone started
typing, it would call what they wrote the reference. There is no tick to wait
for — fields that settle in a render of their own are part of it.

Do not use a `key` on the `<Form>` for this: it remounts every control and every
popup inside it, and anything half-typed goes with them.

## A submit that says it is waiting

A submit that sends nothing is still accepted — in a dialog or a slide it closes
or moves on all the same. In a form that goes nowhere on its own, the press
would visibly do nothing; `readOnlyWhileFormUnchanged` on the button holds it
back and says what it is waiting for.

```jsx
<Button type="submit" readOnlyWhileFormUnchanged>
  Save
</Button>
```

## A control that answers for itself

A control inside a form is expected to carry a value under its name, and a
nameless one is warned about — its state would silently stay out of what is
sent. But some controls inside a form are not answering the form's question at
all: a picker that commits what it holds on its own, a door that only opens
something, a list acting on every touch. They say so with `standalone`:

```jsx
<Picker standalone ui={…} action={commit} />
```

`standalone` is not a filter, it is the absence of a relationship: the control
does not register with the group around it. Nothing goes up (its value is not
collected, the form stays unchanged whatever it does) and nothing comes down
(the form's reset, its validation cascade).

What it does **not** say is "ignore everything around me". `disabled`,
`readOnly` and `loading` travel on their own contexts and go on reaching it,
deliberately: a door with no value of its own can still write into the form
through what its popup does, and a read-only form must still shut it. An
affordance that genuinely writes nowhere says so separately
(`whenSelfInteractionsBlocked="ignore"`), as it says whose press it is with
`selfInteractions`, and a control whose action is meant to be left running
with `actionStandalone` — one question each, one prop each (see
[interactions.md](./interactions.md#the-third-question-whose-value-is-it)).

Every control takes the prop, groups included — `<Form standalone>`, or a
`<List standalone>` sitting beside the one that IS the answer in a picker's
popup (see
[control_object.md](./control_object.md#a-picker-whose-value-is-an-object)).

## See also

- [control_value.md](./control_value.md) — who holds a control's value:
  nothing, a bound `signal`, or you
- [control_object.md](./control_object.md) — one value made of several
  controls: `ControlGroup`, `Form`, and a picker whose value is an object
- [create_and_edit.md](./create_and_edit.md) — the create/edit loop this is
  half of: routes, the resource, and where each screen goes next
- [actions.md](./actions.md) — what an action does around the send itself
