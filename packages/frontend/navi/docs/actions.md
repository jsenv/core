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

## Params: `bindParams`, and calling the action

`createAction` gives one action for the callback; the params make instances of
it, each with its own state:

```js
const getUser123 = getUser.bindParams({ id: 123 });
await getUser123.run();
```

Two `bindParams` with equal params give **the same instance** (deep equality),
which is what makes state shared between two components asking for the same
thing, and what deduplicates their requests.

It is the params that are compared, never what produced them: four components
deriving the same question through four `computed` of their own still ask it
once, and read one state. So a derived params signal can be built wherever it is
convenient — a `useMemo` per caller included — and nothing has to arrange for
one instance of it. What this rests on is params being plain data: a `Set`, a
`Map`, an element, a function or a signal inside them is compared by reference,
and four callers then really do make four requests.

An action is callable, and calling it is the short way to bind and run in one
go:

```js
getUser({ id: 123 }); // getUser.bindParams({ id: 123 }).rerun()
getUser(); // getUser.rerun()
```

Use it wherever a run is a **gesture** — a click handler, an event, a step in a
flow — where the params are known at that moment and the run is the point:

```js
const deleteGame = (game) => GAME.DELETE({ id: game.id });
```

Use `bindParams` when what you need is the **instance**, not the run: to hand it
to a component that will run it and read its state
(`<Button action={GAME.DELETE.bindParams({ id })}>`), or to keep a handle on it.
Note that calling the action `rerun()`s it — the run happens even if that
instance already holds data, which is what you want from a gesture and not what
you want from a component asking for data.

Params may be signals, and then the action follows them:

```js
const userAction = getUser.bindParams({ id: userIdSignal });
// a new params value reruns it
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

There is no effect here and nothing to own: the delay lives in the binding, and
two call sites passing the same signal and the same delay get the same instance,
so the four components of one screen reading the same question ask it once. That
is the shape to reach for whenever the screen owns its params signal.
`actionRunEffect` is the other one, and what it adds is the run: use it when the request must go out whether or not something
is drawing it. During the delay the instance is still the previous one, holding
the previous answer — `loading` is what says a newer one is coming, don't
compare params by hand to find out.

## Running: `run`, `rerun`, `prerun`, `reset`

| Method     | Does                                                                     |
| ---------- | ------------------------------------------------------------------------ |
| `run()`    | Asks for the data. An action already running or completed has it: no-op. |
| `rerun()`  | Runs again whatever state it is in — a refresh, an explicit "check now". |
| `prerun()` | Same as `run()`, in the background: nothing asked for it on screen yet.  |
| `reset()`  | Aborts what is running and puts the action back to idle, data and all.   |
| `abort()`  | Calls off the run in flight, keeping the data it had.                    |

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
both to the nearest `<Loading>` and `<ErrorBoundary>`; pass `{ loading: true }`
or `{ error: true }` to handle either inside the component (stale data stays
available while a rerun is in flight). Where a failure goes when no screen takes
it — and why a run settles with its error rather than rejecting — is
[error_handling.md](./error_handling.md). `useActionStatus(action)` gives the whole
state at once — `{ idle, loading, completed, aborted, error, data, params }` —
for a component that needs to look at it rather than render it. It reads that
very instance: to know what moves when a control is handed the action, see
[the instance a control runs](#the-instance-a-control-runs).

**Reading does not run.** `useAsyncData` waits for data someone else asked for
— for a page, the route, through `routeAction`. A component reading an action
that nobody ran suspends, and `<Loading>` draws nothing for an idle action (no
spinner for a request nobody sent): the whole subtree stays blank, for good. The
obvious fix does not work — a `useEffect` in that same component that would
`run()` it never fires, because a suspended component has no effects, and the
run it was about to start is exactly what the suspension waits for. So either
the action is started **before** anything reads it — bound where the screen is
decided: a `routeAction`, a `<Button action>`, the `action` of the `<Link>` one
came in by — or the component owns its request: a folding panel, a slice a
button asks for. That second one is `{ run: true }`, said in the same line that
reads the data:

```jsx
// asks for it if nobody did, from the render that reads it
const [members] = useAsyncData(membersAction, { run: true });
```

It starts the action from the render rather than from an effect, which is what
makes it work at all: a suspended component has no effects, so a `run()` written
in one would be waiting for itself. Everything else is unchanged — `loading` and
`error` mean what they mean everywhere, delegated by default, handled inline
when asked for — and running an action twice costs nothing, so nothing has to
be guarded.

Where that wait is caught is the caller's business, and a popup is no exception
— see [popup_open.md](./popup_open.md#a-popup-that-loads-data) for what that
costs when it is forgotten.

**`{ run: true }` is the fallback, not the shape to reach for.** A route action
is asked for when the ADDRESS changes, with everything else that address needs;
this one cannot start before the component that draws it exists, which is a
render late at best and a gesture late in a popup. So it is for data nothing
else can ask for — a parameter chosen inside the component and dying with it —
and it says so at the call site, where a hand-written `useEffect` + `run()` said
nothing at all.

Outside a component — a request the app owns rather than a component —
`actionRunEffect(action, () => …)` is that same run declared once: it runs on
the first truthy params, reruns when they change, aborts when they go false. It
is the very machinery `routeAction` is built on.

**Which of the two it is, is decided by the parameter, not by what draws it.**
If the parameter is in the address — a path param, a search param bound to a
`stateSignal` — the data belongs to the screen, and it is a `routeAction`, even
when a popup is the only thing that draws it. The component owns its request
only when the parameter is chosen inside it and dies with it. A popup is never
by itself a reason to own one: being open can be bound too — to a signal, to the
history entry, to the address — and the data of a popup that binds it is a route
action like any other (see
[popup_open.md](./popup_open.md#a-popup-that-loads-data)). Getting this wrong is
invisible at the call site and expensive on screen: the request then leaves with
the gesture instead of with the screen, one waterfall behind everything else the
address needed.

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
thing back: a save, a refresh, a poll all hand the data over again, and copying
it a second time would overwrite what the person is in the middle of writing.
The action knows what it ran with, so nobody has to guess that dependency. It is
called from a layout effect, so what it writes belongs to the same tick as the
render that got the data — which is what lets a `<Form pristineKey>` take its
reference on filled fields (see
[create_and_edit.md](./create_and_edit.md#the-edit-screen-opens-before-its-values)).

Controls take the action itself and wire the rest: `<Button action>` runs it on
click, shows its loading state, and puts its error where the user can see it.
That is the reason to pass an action instance rather than an arrow calling the
callback:

```jsx
// ✓ loading, error and disabled states come from the action
<Button action={GAME_CANDIDATES.POST.bindParams({ id: game.id, user_id })}>
  Accept
</Button>
```

## The instance a control runs

A control binds the action it is given to its own UI state and runs the result.
Which instance that is depends on whether the control carries a value:

- a control with **no value of its own** — a button — contributes no params, so
  what it runs **is** the instance it was handed. `useActionStatus` on that
  instance sees the click, the run, the data.
- a control that **carries a value** — an input, a form — runs the child
  instance bound to that value. Those params are not the caller's, so neither
  is the status: the instance the caller holds stays idle while the control's
  run moves. Read the effect where it lands (the store, for a resource verb),
  or listen to the run itself, below.

Every control with an `action` reports the run it performs, whichever instance
that is:

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

Both fire when a control's value changes, and they are not two ways of writing
the same thing:

|                   | `uiAction(value, event)`                   | `action`                                                                   |
| ----------------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| what it is        | a plain callback                           | an action bound to the control's value                                     |
| while it runs     | nothing                                    | the control is busy (`aria-busy`, its loading state)                       |
| if it fails       | an unhandled rejection — nothing on screen | an error callout on the control, and the control goes back to what it held |
| a popup around it | closes                                     | refuses to close until it is done                                          |

`uiAction` is a notification: the value has changed, here it is. Use it for what
cannot fail — logging, moving something else on screen, keeping a local
variable.

Anything that can fail or take time is an `action`, and it does not have to be
an action instance: a plain function is wrapped into one, bound to the control's
value, so the callback receives what the control now holds.

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
signal and drop the callback entirely — see
[control_value.md](./control_value.md).

## A press that opens something and waits for the answer

A press that runs work is an `action`; one that reports a value is a `uiAction`;
one that asks something of a control near it is a `command` (a value proposed is
`--navi-update`, see
[control_value.md](./control_value.md#a-button-that-proposes-a-value-is---navi-update)).
Reaching for a plain `onClick` usually means one of those was missed.

An `action` and a `command` on the same press are one gesture in two halves, and
the command is the second one: it waits for the action and runs only if it
succeeded. "Leave the group, then go back to the list" therefore never leaves
anyone on a list they are still in — a failure or an abort drops the command and
the error stays on the control, where the user is looking. `<Picker
type="confirm">` follows the same rule with its `action` and `command`, and a
form says it as `data-after-send`.

### Deleting something, then leaving the page it was on

The everyday form of that pair, and the press is a `<Picker type="confirm">`
rather than a `<Button>`: what is destroyed is asked about first, the question
is a popup the picker already owns, and the work runs back on the trigger.

```jsx
<Picker
  type="confirm"
  ui="Leave this group"
  message="Leave this group? An invitation will be needed to come back."
  action={PLAYER_GROUP.LEAVE.bindParams({ id: group.id })}
  command="--navi-nav-to:/me/groups"
/>
```

Yes closes the question and the request goes from the trigger — busy while it
runs, an error callout on it if it fails — and the list is reached only once the
group is really gone. A failure leaves the reader on the page of a group they
are still in, which is the truth, with the reason in front of them.

Navigating first and awaiting after — `navTo(...)` then `await leave(...)` — buys
the frame where this page would render without what it displays, and pays for it
with a reader standing in a list that still holds the group they think they left,
told nothing. There is usually no frame to buy anyway: the response and the
navigation land in the same task.

Where to go afterwards is the app's decision, not navi's. Staying on the page to
say it is done, or letting the route land on its empty state, are as good as
leaving for the list; what the `command` settles is only that the success is
what decides.

The action is the instance, not an arrow around it — `bindParams` is what gives
the trigger its busy state and its error callout, and the reason is the same one
[resource.md](./resource.md#binding-params-instead-of-wrapping-in-an-arrow)
gives for every write.

On a link — a `Link`, a `<Button href>` or `<Button route>` — the three fire on
the press, before the navigation, and the navigation waits for none of them: a
`command="--navi-close"` closes the sheet the link leaves, an `action` that
writes a draft synchronously is found by the next page, and a request goes on
its own while the page changes. Work that decides the destination is not a
link's: it navigates itself, from a `<Button action>`.

The press that looks like a fourth case is the one that opens something and then
does something with what came of it — "save this guest", pressed on a row,
replacing the guest once the profile exists. It is not a fourth case and it is
not a dialog plus a way home: it is a `Picker`, whose whole shape is a trigger,
a popup, and an `action` that runs on what the popup settled.

```jsx
<Picker variant="icon" rightSlotIcon={<DisketteSvg />} action={onCreated}>
  <GuestSavePrompt kind="player" name={guest.name} />
</Picker>
```

Written this way, what the popup needs to know travels as props rather than
through the press, and the popup is built the first time it opens rather than
once per row. See
[popup_open.md](./popup_open.md#a-press-that-opens-a-popup-and-acts-on-it).

What is left for an `onClick` is what no value can express — imperative work
with nothing to open and nothing to send. And one nuance worth knowing: on a
control with `selfInteractions`, a caller's `onClick` runs inside that control's
own interaction gate rather than firing from the DOM (see
[interactions.md](./interactions.md#an-affordance-inside-somebody-elses-box-selfinteractions)),
so the usual objection — an `onClick` fires on a read-only control — does not
apply there. Everywhere else it does.

## `uiAction` mirrors the state, it does not report a gesture

`uiAction` fires whenever the control's state changes, whoever changed it. The
user typing is one cause among several: a `value` prop coming back down after a
render, a popup control propagating its choice up to the picker holding it, a
group cascading a value into its children — all of them reach `uiAction` too, so
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
stays on screen while it does, is in [list_refresh.md](./list_refresh.md) and
[resource_dependencies.md](./resource_dependencies.md).

`rerunActions(actions)` / `updateActions(actions)` drive several at once (route
changes do exactly that).

## See also

- [state_binding.md](./state_binding.md) — `signal`, `action` or
  `command` + `commandFor`: the three shapes, and the callback that only
  remembers
- [resource.md](./resource.md) — actions created from REST callbacks, and the
  store behind them
- [resource_with_params.md](./resource_with_params.md) — `withParams()` and
  isolated rerun scopes
- [list_refresh.md](./list_refresh.md) — what a write refreshes
- [popup_open.md](./popup_open.md#closing-when-a-button-also-runs-an-action) —
  closing a popup from a button that also runs an action (closing from inside
  the action is refused)
