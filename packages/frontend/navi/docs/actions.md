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

The callback receives `(params, { reason, event, signal, isPrerun })`. `signal`
is aborted when the run is called off — pass it to `fetch`.

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

## Running: `run`, `rerun`, `prerun`, `reset`

| Method     | Does                                                                     |
| ---------- | ------------------------------------------------------------------------ |
| `run()`    | Asks for the data. An action already running or completed has it: no-op. |
| `rerun()`  | Runs again whatever state it is in — a refresh, an explicit "check now". |
| `prerun()` | Same as `run()`, in the background: nothing asked for it on screen yet.  |
| `reset()`  | Aborts what is running and puts the action back to idle, data and all.   |
| `abort()`  | Calls off the run in flight, keeping the data it had.                    |

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
for a component that needs to look at it rather than render it.

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
      // the clear cross was pressed — for this row that means "back to the
      // profile level", not "empty"
      draft.level = profile.level;
      return;
    }
    draft.level = value;
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

- [resource.md](./resource.md) — actions created from REST callbacks, and the
  store behind them
- [resource_with_params.md](./resource_with_params.md) — `withParams()` and
  isolated rerun scopes
- [list_refresh.md](./list_refresh.md) — what a write refreshes
- [popup_open.md](./popup_open.md#closing-when-a-button-also-runs-an-action) —
  closing a popup from a button that also runs an action (closing from inside
  the action is refused)
