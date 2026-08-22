# A list while it refreshes

When a write touches one item of a list, two questions decide what the user
sees: **what goes back to the network**, and **what stays on screen meanwhile**.
Getting either wrong turns "pause one row" into a full page reload.

The same two questions decide what a list does when the user leaves it and
comes back, which is the second half of this file.

The short answer:

- A write that returns the modified item fixes every list containing it, with
  no request and no loading state at all.
- `useAsyncData(action, { loading: true })` keeps returning the previous data
  while the action re-runs — the list is never taken away unless the component
  throws it away.
- On the way back, the **source** decides whether anything is asked again — not
  the navigation, and not a transition playing between the two pages.

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

## A paginated list stays on screen too

A `<List.Items>` reading through `GET_RANGE` draws places in a collection, not
a list of ids, so nothing the store does can fix them: a row that changed tab,
or one that was deleted, moves every row after it one rank up, and only the
collection knows who fills the last place.

It is told, and it re-reads by itself:

```jsx
<List.Items
  count={count}
  itemsAction={NOTIFICATION.GET_RANGE.bindParams({ scope })}
  renderItem={(item, index, { refreshing }) => …}
/>
```

The reader keeps no response, so there is nothing to rerun; what it has is a
signal, bumped by the verbs `rerunOn.GET_RANGE` lists (`["POST", "DELETE"]` by
default — `DELETE` is in there precisely because the store cannot fix places).
A run hearing it asks again **for the window it is drawing**, and keeps drawing
it meanwhile:

| Moment                          | what the run draws   | state        |
| ------------------------------- | -------------------- | ------------ |
| nothing received yet            | skeletons            | loading      |
| re-reading after a first answer | the rows from before | `refreshing` |
| answer received                 | the new rows         | —            |

The rows, the scroll position and the row being read all stay; the slices
outside the window are forgotten only once the answer is in, and asked for
again if the user goes back to them. A re-read that fails leaves the rows from
before on screen. While it is in flight, the list carries `navi-refreshing` and
`renderItem` gets `{ refreshing }` — read it as "what you see is from before",
never as "there is nothing to see".

An app that knows a row is on its way out (it is the one deleting it) says so
itself: it is the one rendering the row, so it draws it loading, muted, or not
at all. The run is not told about rows, only about the collection.

```jsx
// ✗ remounting the run to refresh it: the list reopens where it opens, not
//   where it was being read, and the reader is asked again for that window
<List.Items key={`${scope}:${moved}`} … />
```

## Leaving the screen and coming back

A router renders one branch: opening a row unmounts the list that led to it.
Coming back draws the rows from before, with no first load, because the reader
keeps the collection's **composition** — which rank holds which id, and how many
ranks there are — for each set of resolved bound params:

```
GAME.GET_RANGE { scope: "thread" }  →  { count: 412, byIndex: 0 → "W-ABC", 1 → … }
GAME.GET_RANGE { radar: "R-42" }    →  { count: 18,  byIndex: … }
```

Ids, never rows: the rows are in the store already, shared and live, and a row
dropped from the store simply stops resolving — a composition cannot hold a
stale copy of anything.

A run that finds a composition takes the `refreshing` line of the table above
rather than the loading one: the rows are on screen while it asks again for the
window it draws. So the two lists an app cannot tell apart from the outside —
one reading `GET_MANY`, one reading `GET_RANGE` — look the same on the way back:
neither blanks, neither shows a first load. What they do behind that is not the
same, and the next section is about exactly that.

What a composition is about is the **values** its params hold, not the reader
instance: `GET_RANGE.bindParams({ scope: "thread" })` called from two places
reads and writes the same one (and gives back the same reader, memoized the way
an action's `bindParams` is).

The rest follows the rules already stated: a verb in `rerunOn.GET_RANGE`, or
`reader.invalidate()`, drops the compositions — they stand for an order that is
gone — and `memoryBudget` (1000 ranks by default) trims the ranks far from any
window, which are asked for again if the user goes back to them.

### Who decides the re-read — and who does not

The navigation decides nothing. Neither the back button, nor the movement
playing between the two pages: the **source** the list reads through is what
answers, and it answers the same way whether the user arrived by a link, by
`history.back()`, or under a route transition.

| The list reads through          | Coming back to it                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `routeAction` over `GET_MANY`   | **nothing goes out** — the action holds its response, and `.run()` on a `COMPLETED` action is a no-op |
| `<List.Items>` over `GET_RANGE` | **one ask goes out** — the reader kept ranks, not rows, and revalidates the window it draws           |

Both are deliberate, and they are not in tension: an action that kept its answer
has the answer, while a composition is a claim about an order that any write
elsewhere may have made false. What a `GET_MANY` list wants on the way back it
has to say itself — `.rerun()` when the route becomes current again, or a verb
in `rerunOn` if a write is what makes it stale.

Nothing above changes when `defineRouteTransition` is written for the pair the
list is walked through. A transition states a relation between two pages (see
[route_transitions.md](./route_transitions.md)); it takes the document's
rendering hold for the one frame the browser needs to photograph it, and gives
it back. It never decides what the page arriving is allowed to ask for. Held by
`tests/route_transition_list_revisit/`, which mounts the same app twice — with
and without a relation on the pair — and walks the way back ten times on each,
counting what goes out at every revisit.

When a list stops refreshing after a transition was added, two things account
for it, in this order:

1. **The revisit did not happen.** A back taken before the page being opened was
   ever on screen returns to a list that never left, and a page that never left
   has nothing to come back from (see
   [route_transitions.md](./route_transitions.md#waiting-for-a-navigation-the-address-is-not-the-page)).
   This is what an automated walk does by default, and it is the answer far more
   often than the next one.
2. **The list is on the first row of the table.** A `GET_MANY` list never
   refreshed on its own; what changed is whatever else in the app was doing the
   re-read.

### Watching what the run asks for

A run that decides **not** to ask is invisible from the application's side: it
sends nothing and changes no state, so the network is silent and
`onRequestStateChange` — which reports what a request is doing — has no request
to report. A run that declined and a run that was never mounted look identical.
`debugScroll` is where that difference is visible; it carries the render window
and the run's asking, which are one subject.

```jsx
window.askLog = [];
<NaviDebug debugScroll={(...args) => window.askLog.push(args.join(" "))}>
  <MyList />
</NaviDebug>;
```

One line per pass of the run, whatever the outcome:

```
ask 0-49: sent (revalidating=true holdPending=false count=412)
ask -1--1: nothing missing (revalidating=false holdPending=false count=412)
ask 0-49: held on a row not reached yet (revalidating=true holdPending=true count=412)
```

| outcome                              | what it means                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `sent`                               | the range on the line went out                                                                          |
| `nothing missing`                    | the run holds every row it draws and has nothing to revalidate                                          |
| `held on a row not reached yet`      | the list is on its way somewhere the window does not frame; only the row it is held on can be asked for |
| `already revalidating`               | a revalidation for this window is in flight                                                             |
| `a request still covers this window` | what is in flight is still what the list would draw                                                     |
| `this range was asked for already`   | asking again could only produce the same answer                                                         |

The state that decides is on the line rather than left to be inferred:

- **`revalidating`** — the run knows what it holds is from before. A revisit
  showing `revalidating=false` never restored a composition, which is a
  different problem from one showing `revalidating=true` and no `sent`.
- **`holdPending`** — the list is held somewhere it has not reached.
- **`count`** — how many rows the run stands for, `undefined` before its first
  answer.

**Record, do not print.** The sink is called during rendering: push into an
array. Formatting an object in a console costs far more than what it measures,
and a timing-sensitive symptom moves under one — a list that fails to refresh on
the first revisit can start refreshing on the first two as soon as a
`console.log` is in the way, which makes the log a report about the log.

An absence in the trace is a fact too: no line for a revisit means the run never
rendered, which is about the list being mounted, not about what it asked for.
The usual cause is a revisit that never happened — a back taken before the page
being opened was ever on screen, which returns to a list that never left (see
[route_transitions.md](./route_transitions.md#waiting-for-a-navigation-the-address-is-not-the-page)).

## `rerunOn`, verb by verb

`rerunOn` says which verbs invalidate this resource's `GET` / `GET_MANY` /
`GET_RANGE`:

```js
const GAME_RADAR = resource("game_radar", {
  rerunOn: { GET_MANY: ["POST", "DELETE"] },
  …
});
```

Defaults are `{ GET: false, GET_MANY: ["POST"], GET_RANGE: ["POST", "DELETE"] }`:

| Default                         | Why                                                                                                                                                                                                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET: false`                    | `PUT`/`PATCH` already update the UI through the store; `DELETE` resets the `GET` rather than re-running it, so a deleted item shows nothing instead of a spinner then a 404. Give the deleted case its own UI (an "item not found" panel, a redirect) instead of `GET: ["DELETE"]`. |
| `GET_MANY: ["POST"]`            | Whether a new item belongs in this list depends on filters, pagination, sort — the backend knows, the client does not. `DELETE` is excluded because the store already removes the item from every list.                                                                             |
| `GET_RANGE: ["POST", "DELETE"]` | A slice is a range of places: a row leaving the collection shifts every place after it, which the store cannot do. Add the verb that moves an item in or out of the collection — a `PATCH` that archives, one that changes an item's tab.                                           |

Adding `PUT`/`PATCH` to `GET_MANY` is the usual over-correction: it costs a
request and a `loading` pass to obtain something the response already contained.
When a `PATCH` "doesn't show", the fix is almost always server-side — return the
updated item — not client-side refreshing.

## Decision table

| What changed                | Re-read the list?                                    |
| --------------------------- | ---------------------------------------------------- |
| a field of one item         | no — the write's response is enough                  |
| membership of the list      | yes (`POST`) — the backend decides who belongs       |
| the ORDER of the list       | yes — the store stores, it does not sort (see below) |
| nothing came back (`204`)   | yes — there is nothing to put in the store           |
| a place in a paginated list | yes — a `GET_RANGE` reads places, and places shift   |

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

- [route_transitions.md](./route_transitions.md#waiting-for-a-navigation-the-address-is-not-the-page)
  — why a walk away and back has to wait for the page arriving, and what a list
  does when it did not
- [resource.md](./resource.md) — `resource()`, relations, callback return
  contracts
- [resource_dependencies.md](./resource_dependencies.md) — invalidating a
  resource from another one
