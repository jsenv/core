# A list while it refreshes

When a write touches one item of a list, two questions decide what the user
sees: **what goes back to the network**, and **what stays on screen meanwhile**.
Getting either wrong turns "pause one row" into a full page reload.

The short answer:

- A write that returns the modified item fixes every list containing it, with
  no request and no loading state at all.
- `useAsyncData(action, { loading: true })` keeps returning the previous data
  while the action re-runs — the list is never taken away unless the component
  throws it away.

## `loading: true` returns the previous value

`useAsyncData` returns `[data, loading, error]`. During a re-run, `data` is the
**previous data**, not `undefined`:

| Moment                | `data`      | `loading` |
| --------------------- | ----------- | --------- |
| never completed yet   | `undefined` | `true`    |
| running after success | previous    | `true`    |
| completed             | fresh       | `false`   |

So the emptiness test is `data === undefined`, never `loading`:

```js
const [items, loading] = useAsyncData(ACTION, { loading: true });
if (items === undefined) {
  return null; // first load: there is nothing to show yet
}
return <RadarList radars={items} busy={loading} />; // re-read: stay on screen
```

```js
// ✗ blanks the page on every re-run, for a checkbox on one row
if (loading) {
  return null;
}
```

Read `loading` as "what you are displaying is from before", not "there is
nothing to display".

`<List loading>` is the first-load answer, not the refresh one: it replaces the
rows with skeletons. Pass it while stale rows exist and they disappear — same
mistake as `loading ? null :`, one level down.

## What updates without a request

An action's `data` is a computation over the resource store, not a snapshot of
its own last response. Any write that puts an item into the store recomputes
every list holding it, while the `GET_MANY` action stays `COMPLETED` — no
request, no loading state, no flicker.

The condition is the whole hinge of the system:

> **the write's callback must return the item, with its key** — `{ id, … }`.

Partial props are fine (`{ id, paused: true }` merges into the stored item); the
key is what cannot be missing. The corollary matters just as much: a callback
that returns nothing — a `204`, or a `fetch` whose result is dropped — writes
nothing to the store, and the change never reaches the screen. There, the only
way back is a re-read.

`DELETE` is symmetric: returning the id drops the item from the store, and every
list containing it drops it too.

## `rerunOn`, verb by verb

`rerunOn` says which verbs invalidate this resource's `GET` / `GET_MANY`:

```js
const GAME_RADAR = resource("game_radar", {
  rerunOn: { GET_MANY: ["POST", "DELETE"] },
  …
});
```

Defaults are `{ GET: false, GET_MANY: ["POST"] }`:

| Default              | Why                                                                                                                                                                                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET: false`         | `PUT`/`PATCH` already update the UI through the store; `DELETE` resets the `GET` rather than re-running it, so a deleted item shows nothing instead of a spinner then a 404. Give the deleted case its own UI (an "item not found" panel, a redirect) instead of `GET: ["DELETE"]`. |
| `GET_MANY: ["POST"]` | Whether a new item belongs in this list depends on filters, pagination, sort — the backend knows, the client does not. `DELETE` is excluded because the store already removes the item from every list.                                                                             |

Adding `PUT`/`PATCH` to `GET_MANY` is the usual over-correction: it costs a
request and a `loading` pass to obtain something the response already contained.
When a `PATCH` "doesn't show", the fix is almost always server-side — return the
updated item — not client-side refreshing.

## Decision table

| What changed              | Re-read the list?                                    |
| ------------------------- | ---------------------------------------------------- |
| a field of one item       | no — the write's response is enough                  |
| membership of the list    | yes (`POST`) — the backend decides who belongs       |
| the ORDER of the list     | yes — the store stores, it does not sort (see below) |
| nothing came back (`204`) | yes — there is nothing to put in the store           |

## The store stores, it does not sort

Each `*_MANY` action holds its own array of ids; its data is those ids resolved
against the store, in that order. A `PUT_MANY` returning the collection in a new
order updates every item, and sets the order **of the `PUT_MANY` action** — the
`GET_MANY` list keeps the order it already had.

That is the design (a store is not an index), but it has a sharp edge: a
drag-and-drop that "works" on screen — because local state holds the order —
comes back in the old order on the next visit. After a reorder, re-read the list
explicitly:

```js
await REORDER_ACTION.run({ … });
GET_MANY_ACTION.rerun();
```

## `.rerun()`, not `.run()`, to refresh

`.run()` on an action that already `COMPLETED` does nothing: it is a request to
have the data, and the data is there. Wiring a "check now" button to `.run()`
therefore checks nothing, silently. Use `.rerun()`, which resets the action and
runs it again.

## See also

- [resource.md](./resource.md) — `resource()`, relations, callback return
  contracts
- [resource_dependencies.md](./resource_dependencies.md) — invalidating a
  resource from another one
