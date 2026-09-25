# What may go out — the network policy

One declaration says whether a request may leave, and the action layer reads it
everywhere it matters. Two things follow from it:

- **writes are held.** A control bound to a `POST`, `PUT`, `PATCH` or `DELETE`
  action — or sitting in a form bound to one — is read-only and says why,
  before the press.
- **reads are answered from the store.** A resource `GET` completes with the row
  it already holds and asks nothing.

The second one is the only choice in the whole thing: `reads`. An app with no
network wants both, and that is the default. An app holding writes for a reason
of its own — a tab reading every screen as somebody else, where fresh answers
are the entire point — wants only the first, and says `reads: "network"`.

## What navi keeps without being asked

What an app wants when the network is gone is one sentence: **answer from what
you already hold, ask nothing, and refuse writes politely.** Nothing in it is
about one app; navi does it once, and an app only has to say _when_.

Leaving a page erases nothing. Four facts of the action layer add up to a
cache the app never has to write:

- **The data of a resource action is the store row.** A `GET` completes with an
  id, and `action.data` is `store.select(id)`, live. Whatever was read once is
  still there, updated by every later response that mentions it.
- **A route action left behind is aborted, not reset.** Its value survives; only
  a run in flight is called off.
- **Running a completed action is a no-op.** Coming back to `/games/abc` from
  the list sends nothing while the instance that read it is alive — `run()` on a
  `COMPLETED` action already has its data. Only `rerun()` goes back to the
  network (see [actions.md](./actions.md)). An instance nothing references any
  more is asked again, with the store row drawn meanwhile; under the policy
  that ask is answered from the store (below).
- **A failed rerun keeps the previous value.** Only `errorSignal` and the
  running state move; what was on screen stays on screen.

So an app that caches responses in a `Map` beside navi is keeping a second copy
of what the store holds — and going stale on its own.

## The one thing the app decides: the reason

Which moments count as "offline" is the app's. A device without a network
interface, a mode chosen in the settings, an outage the user agreed to stop
fighting — these are not said the same way to the user, and an app may have
none, one or all of them. Navi asks for a single value, the **reason**, and
reads it everywhere it matters:

```js
import { setNetworkPolicy } from "@jsenv/navi";

// null → go to the network; any truthy value → do not, and carry it
setNetworkPolicy(offlineReasonSignal, {
  readOnlyMessage: (reason) =>
    reason === "device"
      ? "No network: this cannot be sent."
      : "Offline mode: this cannot be sent.",
});
```

The source may be a signal (followed live), a function, or a plain value. Set
it once, at startup; there is nothing else to wire.

## What the policy changes

Under a truthy reason, no write callback is called, and no read callback either
while reads are answered from the store. What happens instead depends on what
was asked:

- **A `GET` answers from the store.** If the row it designates is there, the
  action completes with it and nothing is asked. The row is the one its params
  name — by the resource's `idKey`, or by any of its `uniqueKeys` — or, when
  the params name none (a `GET` without params, like `/me`), the row the
  action last completed with. Going from game A to game B, both read
  before, is a change of params that would normally rerun `GAME.GET`; under the
  policy it completes from the store, and a screen that does not take
  `error: true` keeps drawing what it holds instead of falling into its error
  boundary. A route opening a user by id **or** by slug gives navi both keys to
  look by: `resource("user", { uniqueKeys: ["slug"], … })`.
- **A completed read stays completed.** `GET_MANY` (and every other read) has
  nowhere to answer from: the store holds items, not queries, and only the
  action's own value knows which ids answered `/users?scope=shareable`. So a
  rerun asked of a completed read under the policy is held — the action keeps
  its state, its value and its data, exactly as a `run()` on a completed action
  would. This is the piece an app cannot do on its own: by the time a callback
  runs, its action has already been reset.
- **A `GET_RANGE` revalidation fails quietly.** A list that comes back to the
  screen draws the composition it left and asks again for the window it draws;
  under the policy that ask fails, and a failed revalidation keeps the rows it
  had. Only a window never loaded shows the failure.
- **Everything else settles with a `NetworkPolicyError`.** A read with nothing
  in the store, a relationship `GET` (it has no row of its own to answer with), a
  write that got through anyway: the action ends `FAILED` with an error whose
  `reason` is the policy's value. `isNetworkPolicyError(error)` tells it apart
  from a request that left and never came back — that one is the app's `fetch`
  rejecting, and the app names it. The class says the request never left, and
  nothing more: which policy held it, and whether there was a network at all, is
  the reason.

  It is an error only in the way it travels. Nothing treats it as a bug: navi
  never reports it as unhandled, and when one reaches `window` anyway — a run
  called by hand whose failure nobody catches, a render throw no boundary took
  — navi cancels the event, so neither the browser console nor the jsenv
  overlay says anything. The person reads the screen; nobody else has to hear
  about it.

  One line is left, in dev only. A boundary displaying it — `<ErrorBoundary>`,
  a control with `actionErrorEffect="throw"` — makes `preact/debug` log it with
  `console.error`, as it logs every error a boundary catches, 404s and failed
  fetches included. `preact/debug` reads no option or flag that would say the
  error is handled, so that line stays. The jsenv overlay stays quiet, and a
  build does not load `preact/debug`.

- **A write is refused before the press.** A control bound to a `POST`, `PUT`,
  `PATCH` or `DELETE` action — or any control inside a `<Form>` bound to one —
  is read-only while the policy holds, and answers the press with
  `readOnlyMessage`. Nothing to add per button.

Which actions the policy sees: those declaring a verb (`meta.verb`) — every
action a `resource()` makes. A plain `createAction` may not touch the network
at all, so it is left alone. `createAction(callback, { meta: { verb } })` opts
it into what the action layer holds — a control bound to a write verb is
read-only, a completed `"GET"` is not rerun — but its callback is still called
when it runs: answering from the store and settling with a `NetworkPolicyError`
are done by the callbacks a `resource()` wraps.

## Holding writes while reads go out

`reads: "network"` keeps the first half of the policy and drops the second: the
writes are held, and every read leaves as it normally would — nothing is
answered from the store, nothing is held back on rerun.

```js
setNetworkPolicy(viewAsReasonSignal, {
  reads: "network",
  readOnlyMessage: () => "We are only looking.",
});
```

The mode that wants this is one where the reads are the point. "View the site as
someone": an admin opens the app in a tab that reads everything as another
account, to see the screen that person sees. Every read must go out — a fresh
answer, computed for somebody else — and every write must be held, because the
server refuses them and because a write must never quietly land on the admin's
own account.

What this buys over a guard in the app's own request layer is **when** the
refusal happens. A guard one layer below sees a request that was already built:
the press was accepted, the sheet opened, the form submitted, and only then does
it fail. navi knows which controls are bound to a write before any of that, so
the button says why instead of being pressed, and the dialog it would have
opened never opens. A button that always fails teaches people not to press
buttons.

## Two reasons at once

There is one policy, and an app that has two reasons at the same time — no
network **and** viewing as someone — composes them into one:

```js
const networkPolicyReasonSignal = computed(
  () => offlineReasonSignal.value ?? (viewAsSignal.value ? "view-as" : null),
);
setNetworkPolicy(networkPolicyReasonSignal, {
  // Offline is the stricter of the two: nothing leaves, so the reads are
  // answered from the store even in a tab that is viewing as someone.
  reads: (reason) => (reason === "view-as" ? "network" : "store"),
  readOnlyMessage: (reason) =>
    reason === "view-as" ? "We are only looking." : offlineMessage(reason),
});
```

`reads` is read from the reason for exactly this: one declaration, and the
reason decides which kind of policy is holding. The `??` above is the
precedence, and it is the app's to write — when both hold the same write, which
one says why is something navi has nothing to decide it with.

## What stays the app's

- **A button that only leads to a write** — one opening a dialog whose form
  will send — is bound to no write action, so navi cannot know. The app marks
  it, with the reason it reads live:

  ```jsx
  const reason = useNetworkPolicyReason();
  <Button
    command="--navi-open"
    readOnly={reason !== null}
    readOnlyMessage="…"
  />;
  ```

- **What a screen says on a `NetworkPolicyError`** — "no network" is a fact
  about the device, "offline mode" a decision, "we are only looking" neither;
  `error.reason` is there so the screen says the right one.
- **Persisting the store to disk**, so that a reload offline reopens a full
  app rather than an empty one.
- **A queue of writes to replay** once the network is back. Deliberately not
  navi's: what a replayed write means (a score entered twice? a seat taken
  since?) is the app's business.

## See also

- [resource.md](./resource.md) — the store, the callbacks and their contracts
- [actions.md](./actions.md) — `run` vs `rerun`, what a failing action does
- [error_handling.md](./error_handling.md) — where an error appears depending
  on where it came from
