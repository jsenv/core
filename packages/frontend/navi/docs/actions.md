# Actions

An action is an async callback plus the state of its last run, held in signals:
running or not, the error it failed with, the data it produced. Components read
that state instead of keeping their own.

```js
import { createAction } from "@jsenv/navi";

const getUser = createAction(async ({ id }, { signal }) => {
  const response = await fetch(`/users/${id}`, { signal });
  return response.json();
});
```

The callback receives `(params, { reason, event, signal, isPrerun, action })`.
`signal` is aborted when the run is called off — pass it to `fetch`. `action` is
the instance being run.

`resource()` creates one action per REST callback rather than having you write
them by hand — see [resource.md](./resource.md).

- [Params: `bindParams`, and calling the action](#params-bindparams-and-calling-the-action)
  - [The answer is kept on the instance that ran](#the-answer-is-kept-on-the-instance-that-ran)
  - [The in-between states of a gesture are real params](#the-in-between-states-of-a-gesture-are-real-params)
- [Running: `run`, `rerun`, `prerun`, `reset`](#running-run-rerun-prerun-reset)
  - [Aborting saves resources, it does not undo](#aborting-saves-resources-it-does-not-undo)
- [Reading an action](#reading-an-action)
- [The instance a control runs](#the-instance-a-control-runs)
- [`action` or `uiAction`](#action-or-uiaction)
- [A press that opens something and waits for the answer](#a-press-that-opens-something-and-waits-for-the-answer)
  - [Deleting something, then leaving the page it was on](#deleting-something-then-leaving-the-page-it-was-on)
- [`uiAction` mirrors the state, it does not report a gesture](#uiaction-mirrors-the-state-it-does-not-report-a-gesture)
- [Reruns](#reruns)
- [See also](#see-also)

## Params: `bindParams`, and calling the action

`createAction` gives one action for the callback; the params make instances of
it, each with its own state:

```js
const getUser123 = getUser.bindParams({ id: 123 });
await getUser123.run();
```

Two `bindParams` with equal params give **the same instance** (deep equality):
that is what shares state between two components asking for the same thing, and
deduplicates their requests, however each one derived its params — a `computed`
or a `useMemo` per caller included. What this rests on is params being plain
data: a `Set`, a `Map`, an element, a function, or a signal nested below a
param (`{ filter: { id: idSignal } }`) is compared by reference, and four
callers then really do make four requests. A signal given as a param's own
value (`{ id: idSignal }`) is read, and compared by what it holds.

An action is callable, and calling it is the short way to bind and run in one
go — for a run that is a **gesture** (a click handler, an event, a step in a
flow), where the params are known at that moment and the run is the point:

```js
getUser({ id: 123 }); // getUser.bindParams({ id: 123 }).rerun()
getUser(); // getUser.rerun()
const deleteGame = (game) => GAME.DELETE({ id: game.id });
```

Calling it `rerun()`s it: the run happens even if that instance already holds
data, which is what you want from a gesture and not from a component asking for
data. A run that fails **rejects**, or **throws synchronously** when the
callback was synchronous, so an action awaiting it fails with it — which is what
puts the error on the control that asked for the gesture (the runs with nobody
to reject at: [error_handling.md](./error_handling.md#what-a-failing-action-does)).

Use `bindParams` when what you need is the **instance**, not the run: to keep a
handle on it, or so that a run started in one place is visible from another
(what a control gains from holding it:
[resource.md](./resource.md#a-function-calling-the-verb-or-the-instance)).

Params may be signals, and then the instance follows them:

```js
const userAction = getUser.bindParams({ id: userIdSignal });
// a new id retargets it to the instance for that id; a component reads it,
// and starts it, with useAsyncData(userAction, { run: true })
```

`{ debounce }` puts a delay between the signal and the instance, for params that
move faster than a request should — a search box, a wheel, a slider:

```js
const searchAction = USER.GET_MANY.bindParams(questionSignal, {
  debounce: 300,
});
const [found, searching] = useAsyncData(searchAction, {
  run: true,
  loading: true,
});
```

The delay lives in the binding — no effect, nothing to own — and two call sites
passing the same signal and delay share the instance. During the delay it holds
the previous answer, and `loading` says a newer one is coming: don't compare
params by hand. It follows where the signal **settles** (`A → B → A` sends
nothing for `B`). `actionRunEffect`, which takes the action itself and a params
getter, is for a request that must go out whether or not something draws it.

### The answer is kept on the instance that ran

An action's state — `dataSignal`, `errorSignal`, `runningStateSignal` — belongs
to the instance the params made, never to the action they were bound from. So
the thing to read is whatever `bindParams` (or anything built on it) gave back:

```js
const COUNTS = routeAction(ANY_PAGE, ADMIN_COUNTS.GET, () => true);

COUNTS.dataSignal.value; // the answer
ADMIN_COUNTS.GET.dataSignal.value; // undefined, for ever
```

`routeAction` binds params — `() => true` is params too — so the answer lands on
the child, and the verb stays idle: nothing failed, nothing warns, the screen
simply has no numbers in it. The same holds for the instance a control runs
([below](#the-instance-a-control-runs)). A module-level signal derived from a
verb — `computed(() => ME.GET.dataSignal.value)` — only works for a verb
something runs **directly**, with no params; anything else derives from the
instance: `computed(() => COUNTS.dataSignal.value)`.

### The in-between states of a gesture are real params

The delay decides _when_ a question goes out, never _which_ one is coherent: it
sees every write, including the ones a gesture only passes through. Moving an
item by filling the new slot and then emptying the old one is two writes, and
between them the item is in both — a question nobody meant to ask, sent if the
delay lands there. Make the intermediate not matter rather than counting on the
delay to hide it:

- **`batch()` the writes that belong to one gesture**, so the intermediate state
  never exists — not for the delay, not for a render, not for a validation rule
  reading the same signals.
- **Shape the question so equivalent states compare equal.** Params are compared
  deeply, so a list whose order carries nothing asks a new question every time
  it is rearranged; sent deduplicated and sorted, it stops changing.

## Running: `run`, `rerun`, `prerun`, `reset`

| Method     | Does                                                                     |
| ---------- | ------------------------------------------------------------------------ |
| `run()`    | Asks for the data; running or completed, it joins what is there.         |
| `rerun()`  | Runs again whatever state it is in — a refresh, an explicit "check now". |
| `prerun()` | Same as `run()`, in the background: nothing asked for it on screen yet.  |
| `reset()`  | Aborts what is running and puts the action back to idle, data and all.   |
| `abort()`  | Calls off the run in flight, keeping the data it had.                    |

A "check now" wired to `run()` therefore checks nothing, silently.

### Aborting saves resources, it does not undo

`abort()` cancels what can still be cancelled — a `fetch` wired to the
callback's `signal` — and nothing more. The server may have done the work
before the cancellation reached it, or may not honor cancellations at all:
whether the work happened is known from the run's settlement alone. For that
reason a run's promise settles only when its callback settles, even after an
abort, and anything sequenced behind a run — an optimistic control's queued
request, for instance — waits for that settlement, never for the abort.

## Reading an action

```jsx
const [user] = useAsyncData(userAction);
```

`useAsyncData` suspends until the data is there and throws on failure, leaving
both to the nearest `<Loading>` and `<ErrorBoundary>`; `{ loading: true }` or
`{ error: true }` hands either over as a value instead, the component staying
mounted — what it then draws is [data_states.md](./data_states.md), where a
failure nobody takes goes is [error_handling.md](./error_handling.md).
`useActionStatus(action)` gives the whole state of that very instance at once —
`{ idle, loading, completed, aborted, error, data, params }` — for a component
that needs to look at it rather than render it.

**Reading does not run.** `useAsyncData` waits for data someone else asked for
— for a page, the route, through `routeAction`. A component reading an action
nobody ran suspends, and `<Loading>` draws nothing for an idle action: the
subtree stays blank, for good. A `useEffect` that would `run()` it never fires,
since a suspended component has no effects. So either the action is started
**before** anything reads it — a `routeAction`, a `<Button action>`, the
`action` of the `<Link>` one came in by — or the component owns its request and
says so where it reads the data, which starts it from the render:

```jsx
// asks for it if nobody did, from the render that reads it
const [members] = useAsyncData(membersAction, { run: true });
```

`loading` and `error` keep their meaning, and running an action twice costs
nothing, so nothing has to be guarded. Where that wait is caught is the caller's
business, a popup included
([popup_open.md](./popup_open.md#a-popup-that-loads-data)).

**`{ run: true }` is the fallback, not the shape to reach for.** A route action
is asked for when the ADDRESS changes, with everything else that address needs;
this one cannot start before the component that draws it exists — a render late
at best, a gesture late in a popup. It is for a parameter chosen inside the
component and dying with it. Outside a component,
`actionRunEffect(action, () => …)` is that same run declared once — it runs on
the first truthy params, reruns when they change, aborts when they go false —
and the machinery `routeAction` is built on.

**Which of the two it is, is decided by the parameter, not by what draws it.**
If the parameter is in the address — a path param, a search param bound to a
`stateSignal` — the data belongs to the screen, and it is a `routeAction`, even
when a popup is the only thing that draws it: being open can be bound too, and
the data of a popup that binds it is a route action like any other. Getting this
wrong is invisible at the call site and expensive on screen: the request leaves
with the gesture instead of with the screen, one waterfall behind everything
else the address needed.

**A route action is a read.** An address asks again on every arrival — a
reload, a pasted link, a step back — which is what a read is for and what a
write cannot survive: `POST /users/:id/invitations` hung on `/users/:id` mints a
token per reload, for ever. A run that writes belongs to the component that
decided to write, whatever its parameter, and `{ run: true }` says it — a token
a share button must already hold when pressed, for instance, since the OS share
sheet only opens inside the gesture, never after an `await`.

`{ onLoad }` is what the screen does with the data **once, when it becomes
known** — seed the fields someone is about to edit, focus something, remember
where a list was:

```jsx
const [game] = useAsyncData(gameAction, {
  loading: true,
  onLoad: (game) => {
    nameSignal.value = game.name;
  },
});
```

It fires once per set of params, never again for a rerun that brings the same
thing back — a save, a refresh, a poll would otherwise overwrite what the person
is writing — and from a layout effect, so a `<Form pristineKey>` takes its
reference on filled fields
([create_and_edit.md](./create_and_edit.md#the-edit-screen-opens-before-its-values)).

## The instance a control runs

A control takes the action and wires the rest — `<Button action>` runs it on
click, draws its wait, puts its error where the user can see it — whether it is
handed an action or a plain function, which it wraps into one (what that wrapper
lacks against a resource verb's instance:
[resource.md](./resource.md#a-function-calling-the-verb-or-the-instance)). It
binds what it is given to its own UI state and runs the result, so which
instance runs depends on the value the control carries:

- a **button outside any form or group** contributes no params, so what it runs
  **is** the instance it was handed: `useActionStatus` on that instance sees the
  click, the run, the data.
- a **button inside a `<Form>` or another group**, with no `value` of its own,
  carries the value around it — a submit carries its form's — and runs the
  child instance bound to that value, as the controls below do.
- a control that **carries a value** — an input, a form — runs the child
  instance bound to that value: the value merged over the params the caller
  bound, and a value that is not an object **replaces them outright**. A
  checkbox handed `ACTION.bindParams({ id })` runs `ACTION(true)`, and `id` is
  gone — the call fails wherever it needed it, far from the binding that lost
  it. Bind params to a control that holds a value only when the value completes
  them (a form's object over a bound `{ id }`); when it would replace them, pass
  a function and keep the params in its closure:
  `action={() => ACTION({ id, sure: true })}`.

In those last two cases the params are not the caller's, so neither is the
status: the instance the caller holds stays idle while the control's run moves.
Read the effect where it lands (the store, for a resource verb), or listen to
the run itself — every control with an `action` reports the run it performs:

```jsx
<Button
  action={shareAction}
  onActionStart={(e) => {}}
  onActionEnd={(data, e) => {}}
  onActionError={(error, e) => {}}
  onActionAborted={(e) => {}}
/>
```

`onActionEnd` receives the data of a run that **completed** — a failure never
reaches it. A failure goes to `onActionError`, alongside wherever the error is
displayed (see [error_handling.md](./error_handling.md)); an abort to
`onActionAborted`.

## `action` or `uiAction`

Both fire when a control's value changes — and on a control that holds no value,
a `<Button>` or a `<Link>`, the press itself is that occasion: each runs once per
press. They are not two ways of writing the same thing:

|                   | `uiAction(value, event)`                   | `action`                                             |
| ----------------- | ------------------------------------------ | ---------------------------------------------------- |
| what it is        | a plain callback                           | an action bound to the control's value               |
| while it runs     | nothing                                    | the control is busy (`aria-busy`, its loading state) |
| if it fails       | an unhandled rejection — nothing on screen | an error callout on the control                      |
| a popup around it | closes                                     | refuses to close until it is done                    |

A failed `action` also puts back what the control held where `resetOnError` is
on — by default a checkbox, a radio, their groups, a picker, a selectable list
and `<Details>`; a text input and a form keep the value that was refused.

`uiAction` is a notification: the value has changed, here it is. Use it for what
cannot fail — logging, moving something else on screen, keeping a local
variable. Anything that can fail or take time is an `action`, and it does not
have to be an action instance: a plain function is wrapped into one, bound to
the control's value, so the callback receives what the control now holds.

```jsx
// ✓ the box shows it is saving, says so if the save fails, and goes back to
//   where it was — nothing to write for any of it
<Input type="checkbox" action={(visibility) => saveMe({ visibility })} />

// ✗ same save, and the user learns nothing: no pending state, and a failure
//   leaves the box showing something the server never accepted
<Input type="checkbox" uiAction={(visibility) => saveMe({ visibility })} />
```

The give-away is an `async` `uiAction`, or one that calls something that writes:
`uiAction` never waits for what it starts, so nobody is left holding the result.
To merely REMEMBER the value rather than send it, neither is the answer: bind a
signal and drop the callback — see [control_value.md](./control_value.md).

## A press that opens something and waits for the answer

A press that runs work is an `action`; one that reports a value is a `uiAction`;
one that asks something of a control near it is a `command` (a value proposed is
`--navi-update`, see
[control_value.md](./control_value.md#a-button-that-proposes-a-value-is---navi-update)).
Reaching for a plain `onClick` usually means one of those was missed.

An `action` and a `command` on the same press are one gesture in two halves, and
the command is the second one: **it waits for the action and runs only if it
succeeded.** "Leave the group, then go back to the list" therefore never leaves
anyone on a list they are still in — a failure or an abort drops the command and
the error stays on the control, where the user is looking. `<Picker
type="confirm">` follows the same rule with its `action` and `command`, and so
does `<Form command>`, which follows a submission only once it went through.

### Deleting something, then leaving the page it was on

The everyday form of that pair, where what is destroyed is asked about first. A
short question is asked on the button itself: `<Button confirm>` replaces it with
the question and a Confirmer/Annuler pair, and the second press does what the
button was for, its wait and its error on that button. A question long enough to
want a popup, or a row with no room for it, is a `<Picker type="confirm">`, whose
work runs back on the trigger:

```jsx
<Picker
  type="confirm"
  ui="Leave this group"
  message="Leave this group? An invitation will be needed to come back."
  action={() => PLAYER_GROUP.LEAVE({ id: group.id })}
  command="--navi-nav-to:/me/groups"
/>
```

Yes closes the question and the request goes from the trigger — busy while it
runs, an error callout on it if it fails — and the list is reached only once the
group is really gone. A failure leaves the reader on the page of a group they
are still in, which is the truth, with the reason in front of them. Navigating
first and awaiting after — `navTo(...)` then `await leave(...)` — buys nothing
(the response and the navigation land in the same task) and, on a failure,
leaves the reader in a list that still holds the group they think they left,
told nothing.

Where to go afterwards is the app's decision: staying on the page to say it is
done, or letting the route land on its empty state, are as good as leaving for
the list. What the `command` settles is only that the success is what decides.
(The `action` above is a function calling the verb; what that gives up against
the verb's instance is in
[resource.md](./resource.md#a-function-calling-the-verb-or-the-instance).)

On a link — a `Link`, a `<Button href>` or `<Button route>` — the three fire on
the press, before the navigation, and the navigation waits for none of them: a
`command="--navi-close"` closes the sheet the link leaves, an `action` that
writes a draft synchronously is found by the next page, and a request goes on
its own while the page changes. Work that decides the destination is not a
link's: it navigates itself, from a `<Button action>`.

A press that opens something and then does something with what came of it —
"save this guest", pressed on a row — is not a fourth case: it is a `Picker`, a
trigger, a popup, and an `action` that runs on what the popup settled (see
[popup_open.md](./popup_open.md#a-press-that-opens-a-popup-and-acts-on-it)).

What is left for an `onClick` is what no value can express — imperative work
with nothing to open and nothing to send. The usual objection to it — it fires
on a read-only control — holds everywhere but on a control with
`selfInteractions`, whose gate a caller's `onClick` runs inside
([interactions.md](./interactions.md#an-affordance-inside-somebody-elses-box-selfinteractions)).

## `uiAction` mirrors the state, it does not report a gesture

`uiAction` fires whenever the control's state changes, whoever changed it (a
button and a link hold no state to mirror: there, each press is one call). The
user typing is one cause among several: a `value` prop coming back down after a
render, a popup control propagating its choice up to the picker holding it, a
group cascading a value into its children — all of them reach `uiAction`, so
that a signal or a local variable listening to it never drifts out of sync.
Reading it as "the user did something" is the natural mistake.

The second argument says which one it was. Every event navi dispatches carries
the event that caused it, and `findEvent(event, type)` walks that chain back:

```jsx
<Picker
  clearable
  uiAction={(value, event) => {
    if (findEvent(event, "navi_clear_ui_state")) {
      // the cross was pressed — the row is empty because somebody emptied it,
      // not because the last player left the list
      askAgainLater();
      return;
    }
    draft.players = value;
  }}
/>
```

Useful types to match on: `navi_clear_ui_state` (the clear cross, or a
`--navi-clear` command), `navi_reset_ui_state`, and the browser events at the
root of the chain (`click`, `keydown`, `input`) — a change no user gesture
caused has none of them.

## Reruns

Actions do not stay stale on their own: a resource's `POST` reruns the
`GET_MANY` that lists it, a `DELETE` resets the `GET` that loaded the item, and
`dependencies`/`rerunOn` declare the rest. What re-runs after a write, and what
stays on screen while it does, is in [list_refresh.md](./list_refresh.md); a
scope with reruns of its own, and a rerun after another resource writes, are
[`withParams()`](./resource.md#withparams-a-scope-with-reruns-of-its-own).

`rerunActions(actionSet)` reruns several at once;
`updateActions({ prerunSet, runSet, rerunSet, resetSet })` settles the four
kinds of request in one pass — a route change goes through it.

## See also

- [state_binding.md](./state_binding.md) — `signal`, `action` or
  `command` + `commandFor`: the three shapes, and the callback that only
  remembers
- [resource.md](./resource.md) — actions created from REST callbacks, and the
  store behind them
- [list_refresh.md](./list_refresh.md) — what a write refreshes
- [popup_open.md](./popup_open.md#closing-when-a-button-also-runs-an-action) —
  closing a popup from a button that also runs an action (closing from inside
  the action is refused)
