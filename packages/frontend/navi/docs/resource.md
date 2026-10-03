# resource()

`resource()` models REST state: a reactive store of items, one action per REST
callback, and — this is the part most often missed — parent/child relations.

```js
import { resource } from "@jsenv/navi";

const GAME = resource("game", {
  GET: ({ id }) => fetchJson(`/games/${id}`),
  GET_MANY: () => fetchJson(`/games`),
  POST: (game) => fetchJson(`/games`, { method: "POST", body: game }),
  PUT: ({ id, ...game }) =>
    fetchJson(`/games/${id}`, { method: "PUT", body: game }),
  PATCH: ({ id, ...props }) =>
    fetchJson(`/games/${id}`, { method: "PATCH", body: props }),
  DELETE: ({ id }) => fetchJson(`/games/${id}`, { method: "DELETE" }),
});
```

Each callback returns the data to upsert into the store:

| Callback                 | Returns                           |
| ------------------------ | --------------------------------- |
| GET / POST / PUT / PATCH | the full item object, `{ id, … }` |
| DELETE                   | the id, or `{ id }`               |
| GET_MANY / POST_MANY / … | an array of item objects          |
| GET_RANGE                | `{ items, start, count }` (below) |

Actions are read in components through the action system (`useAsyncData`,
`<Button action>`, …) — see [actions.md](./actions.md). An action's `data` is
`undefined` until its callback has answered once, plural verbs included
([data_states.md](./data_states.md#data-and-loading-are-independent)).

- [`store.upsert()` is not how data enters the store](#storeupsert-is-not-how-data-enters-the-store)
- [`persist`: the last answer, drawn again after a reload](#persist-the-last-answer-drawn-again-after-a-reload)
- [`keepPageOnScreen`: the page on screen, drawn again by the next document](#keeppageonscreen-the-page-on-screen-drawn-again-by-the-next-document)
- [`GET_RANGE`: feeding a list that loads as it scrolls](#get_range-feeding-a-list-that-loads-as-it-scrolls)
- [Searching the same collection](#searching-the-same-collection)
- [Relations: pick one of the four methods](#relations-pick-one-of-the-four-methods)
- [Callback return contracts](#callback-return-contracts)
- [When the backend answers a sub-route with the whole parent](#when-the-backend-answers-a-sub-route-with-the-whole-parent)
- [Relations and autorerun](#relations-and-autorerun)
- [`withParams()`: a scope with reruns of its own](#withparams-a-scope-with-reruns-of-its-own)
  - [`dependencies`: rerun after another resource writes](#dependencies-rerun-after-another-resource-writes)
- [A function calling the verb, or the instance](#a-function-calling-the-verb-or-the-instance)
- [See also](#see-also)

## `store.upsert()` is not how data enters the store

navi writes the store. Declare the resource and its relations, return the shape
each callback owes, and the write happens. A hand-written `store.upsert()` in
the path of a normal request of the resource is the sign that something is
missing: a relation that is not declared, or a callback that does not return
what it should.

`store` is exposed for what is **not** a request of the resource, where writing
it yourself is the point:

- seeding it with data that came from elsewhere — state rendered by the server,
  a websocket message (the resource's own last answer is not "elsewhere": that
  is [`persist`](#persist-the-last-answer-drawn-again-after-a-reload), below);
- absorbing the parent fields a **scoped** relation's route answered with: a
  `.scopedOne()`/`.scopedMany()` callback writes the relation and nothing else
  (see [When the backend answers a sub-route with the whole
  parent](#when-the-backend-answers-a-sub-route-with-the-whole-parent)).

A list that loads its rows a slice at a time is **not** one of those cases —
that is `GET_RANGE`, below.

## `persist`: the last answer, drawn again after a reload

Some `GET`s are the app — `GET /me` answers who is signed in, what the header
and the tab bar draw — and on a reload, or an app reopened from the home screen,
waiting for them is pure loss: the previous answer was on screen a moment ago
and is almost always still true. `persist` puts that reload on the second line
of the table in [data_states.md](./data_states.md#data-and-loading-are-independent)
— the last known row drawn, the request out behind it — and names the signal
that keeps the copy, a `stateSignal` that persists:

```js
const mePersistedSignal = stateSignal(undefined, {
  id: `me@${APP_VERSION}`,
  persists: true,
  type: "object",
});
const ME = resource("me", {
  persist: {
    signal: mePersistedSignal,
    when: () => !viewAsSignal.value,
  },
  GET: () => fetchJson(`/me`),
});
ME.one("user", USER);
ME.many("my_games", GAME);
```

The copy follows the store — a `PUT` on the item, a game joining `my_games`
rewrite it — and the first run of the `GET` draws it as its provisional value:
`data` set while `loading` is `true`, the answer replacing it. Under a network
policy answering reads from the store, the kept row answers the `GET`
([network_policy.md](./network_policy.md)): a reload with no network reopens on
it. A plain `signal()` keeps the copy for the page's lifetime, which is what a
test wants.

What stays the app's, because only the app knows:

- **the key.** A deploy that changes the shape of the answer must not draw the
  old one: put in the signal's `id` whatever makes a copy unusable — the
  deployed version — and a new id starts clean.
- **`when`: is the copy about this session?** A tab viewing as someone else, an
  account being switched — the row is somebody's, and must not be kept for the
  next person. `when` is read whenever the copy is about to be read or written:
  `false` reads nothing, writes nothing, and empties the signal. It is a
  function so it can read a signal, and it has to: a plain variable is only
  looked at again when the store changes.
- **the moment, not the state.** Sign-out is something that happens, not a
  condition that holds: writing `undefined` into the signal forgets the copy at
  once, and nothing is written until a `GET` lands again. The store rows stay —
  the screen keeps what it shows until the app resets the action.
- **what the `GET` feeds beside its return value.** Counts, badges, a feature
  flag set from the response are the app's signals, not the row: they are not
  kept, and the callback does not run on a kept row.
- **the veil.** A loading screen waiting on the `GET` being `running` stays over
  the drawn row for the whole request. It waits on `data` being set — the
  emptiness test of data_states.md — and the refresh is shown as usual.

What the copy is not:

- **an answer.** The `GET` goes out every time; a screen must not read `data` as
  "the server confirmed" — that is `loading`, and the two are independent.
- **a store on disk.** One row per params key, `GET` only: meant for a singleton
  or a handful of rows, not a resource whose `GET` is asked for every id. What
  the page on screen reads, lists included, is
  [`keepPageOnScreen`](#keeppageonscreen-the-page-on-screen-drawn-again-by-the-next-document),
  below.
- **seeded at declaration.** The row enters the store at the first run of the
  `GET`, once the relations are declared, so its relation values are normalized
  as a real answer's are. `ME.store` read before that first run is empty.

## `keepPageOnScreen`: the page on screen, drawn again by the next document

A reload, a pull-to-refresh, a tab the system discarded in the background: a
new document opens at the same address, on the page that was left, and what
that page reads almost always answers what it answered a moment ago. `persist`
keeps one row of one resource. A page reads several things, lists included,
and which ones depends on the page. `keepPageOnScreen` keeps that set, one
slot, replaced when the user moves:

```js
const pageKeptSignal = stateSignal(undefined, {
  id: `page@${APP_VERSION}`,
  persists: true,
  type: "object",
});
// Before the routes start: the first runs are the ones that look.
keepPageOnScreen({
  signal: pageKeptSignal,
  when: () => !viewAsSignal.value,
  always: [MY_GAMES_PAGE],
});
```

**The unit is the page, not the resource.** One resource is read by several
screens: `GAME.GET` for any game opened, `USER.GET_MANY` for a tab and for
every search. Kept per resource, that is every game ever opened. The page's
reads are what navi already runs for it: the route actions asking something for
the page (`activeRouteActionsSignal`, which the app also reads to rerun the page
when it comes back to the foreground), and the compositions the `<List.Items>`
on screen read. A navigation replaces the slot with the next page's reads.

What is kept, for the next document's first run of the same read with the same
params:

| read                                    | kept                                                         |
| --------------------------------------- | ------------------------------------------------------------ |
| a route action on a resource `GET`      | the row, its relations inline                                |
| a route action on a resource `GET_MANY` | the rows in order, written the same way                      |
| a `<List.Items>` reading a `GET_RANGE`  | the count and the ranks around the window drawn, rows inline |

The `GET` and the `GET_MANY` draw it as their provisional value: `data` set
while `loading` is `true`, the answer replacing it. The list finds it as a
composition it left
([list_refresh.md](./list_refresh.md#leaving-the-screen-and-coming-back)): every
rank stale, one request for the window. Under a network policy answering reads
from the store, the kept answer answers the read
([network_policy.md](./network_policy.md)).

What is not kept, and why:

- **a relationship read** (`.one()`, `.many()`, `.scopedOne()`,
  `.scopedMany()`). Its answer enters the store through its owner: the parent
  row it is nested in, or the store of the owner it is scoped to. It is not rows
  of its own that could be written back alone.
- **a plain `createAction`** (a summary, a count the server computes). Its value
  is whatever the callback returns, with no store to give it a shape to write
  and to read back. A page's code is a route action too, and it is a function.
- **a read that is not a route action**: a search typed on the page, a popup's
  own load.

A read writes what it shows once it has answered in this document. Until then
the slot keeps what the previous document kept for it, never what the read
shows meanwhile: an answer handed over from other params (a list standing in
for the next search) is not about these. The write waits for the page to settle
and is flushed when the document is hidden, which is when the system may discard
it. Between those moments a navigation goes through half-built pages: the route
matched but its list not mounted, or the page left still drawn under a
transition.

**The start page.** An installed app launched after being killed opens at its
start address, not on the page that was left. The reads made while a route of
`always` matches stay kept once that page is left, until the next visit
replaces them.

What stays the app's, as for `persist`: **the key** (the deployed version in the
signal's `id`), **`when`** (`false` reads nothing, writes nothing, and empties
the signal), and **the moment**: sign-out writes `undefined` into the signal,
whatever page it holds, and nothing is written again until a read lands. Also
**what the reads feed beside their data**: a count the app sets from an answer
is its own signal to keep. When a list's opening position comes from such a
count, `defaultScrolled` follows the fresh value as long as nobody has moved the
list ([scroll.md](./scroll.md#where-the-list-opens-and-where-it-is)).

What it costs: the copy follows the store, so a `PUT` on a row rewrites it, and
every change in the stores the page reads serializes the page's reads again.
Only the write to the signal is coalesced. A list's window with its rows inline
is tens of kilobytes.

## `GET_RANGE`: feeding a list that loads as it scrolls

A `<List.Items>` asks for the rows it is about to draw and keeps what it gets.
`GET_RANGE` is the resource's answer to that question, one slice at a time:

```js
const GAME = resource("game", {
  GET: ({ id }) => fetchJson(`/games/${id}`),
  GET_RANGE: ({ radar, start, limit }) =>
    fetchJson(`/radars/${radar.id}/games?start=${start}&limit=${limit}`),
  // { items: [{ id, … }, …], start: 20, count: 137 }
});
```

```jsx
<List.Items
  count={radar.match_count}
  itemsAction={GAME.GET_RANGE.bindParams({ radar })}
  renderItem={(game) => <GameCard game={game} />}
/>
```

The callback receives the bound params merged with the range the list asks for
(`start`, `end`, `limit`, `before`, `after`, `around`), and `{ signal }`,
aborted when the list stops wanting those rows. It returns a range the way a
`Content-Range` does: **`{ items, start, count }`** — these rows, at this place,
out of that many. `start` may be omitted when the list asked for one at or after
`0` (a negative `start` counts back from the end, and the source must then say
where the slice landed); `count` defaults to `start + items.length`. The items
are upserted on their way in, so the list draws store items, never copies of the
JSON.

But the list keeps the object it was handed, and an update replaces the item
object (the store holds values, which is what makes a change detectable). So a
row that must follow its **own fields** through a write reads them from the
store:

```jsx
const GameCard = ({ id }) => {
  const game = GAME.useById(id); // the item as it is now
  …
};
```

Relations are not concerned: they are keyed by owner, and a row reading
`game.candidates` reads the shared collection whatever object carries it.

`GET_RANGE` is a **reader, not an action**: it keeps no response and takes no
place in the rerun graph — the list already holds the slices it received, and a
`POST` invalidating "the collection" would otherwise send every slice ever
loaded back to the network at once. What it keeps is the collection's
composition, so a list coming back finds it drawn
([list_refresh.md](./list_refresh.md#leaving-the-screen-and-coming-back)), and a
verb listed in `rerunOn.GET_RANGE` makes it ask again for the window it draws,
rows staying on screen
([list_refresh.md](./list_refresh.md#a-paginated-list-stays-on-screen-too)). It
reads a collection, so it lives on the resource (or on a `withParams()` of it),
not on a relation.

## Searching the same collection

A screen showing a collection soon asks a second question about it: the list
draws a page, a search box goes looking in the whole base for what the page does
not hold. Same entity, same ids — so it is the same `GET_MANY`, with one more
param:

```js
const USER = resource("user", {
  GET_MANY: ({ scope, search }, { signal }) =>
    fetchJson(`/users?${new URLSearchParams({ scope, search })}`, { signal }),
});

const pageAction = USER.GET_MANY.bindParams({ scope: "seatable" });
const searchAction = USER.GET_MANY.bindParams(
  computed(() => ({ scope: "seatable", search: searchSignal.value })),
  { debounce: 300 },
);
```

Not a resource of its own, and not a `createAction` sitting beside the resource:
those answer with **detached copies** — the user a search found is a different
object from the same user everywhere else on screen, it does not follow an
update, and a mutation writes to the one it is not. The resource's own
`GET_MANY` upserts what comes back like any other read, so one object per user
answers both questions.

**Two `GET_MANY` on one resource do not compete.** Each bound instance keeps its
own array of ids (none until it has answered) and resolves it against the shared
store, so answering the search leaves the page's list as it was — clear the
search box and every row it had is still there. It is `bindParams`, not
`withParams`: a word someone typed is not a scope
([`withParams()`](#withparams-a-scope-with-reruns-of-its-own)).

The lifecycle a search wants comes with being an action, read with
`useAsyncData(searchAction, { run: true, loading: true })`
([actions.md](./actions.md#params-bindparams-and-calling-the-action)): the typing
is debounced by the binding, `loading` is up while a word is in flight, and a
word already asked is answered by the instance that asked it, with no second
request.

What stays the app's is what to KEEP of a search once the word changes — the
rows someone picked out of it and expects to still see under the next word.
Keep their **ids**, not the objects: an object is a snapshot, and it stops
following its row the moment anything writes to it. `RESOURCE.useAllByIds(ids)`
reads those rows as they are now — the ids the store no longer holds drop out —
`RESOURCE.useById(id)` one row, `RESOURCE.useArray()` the whole store. None is a
hook (a `.map()` over them is fine), and each subscribes the render that calls
it to what it returns: a card reading its own row stays still while other rows
of the store are written. An entry of `useAllByIds` given by a unique key rather
than by id is found by reading the whole store, and that read follows it too.

A row counts as written only when something in it changed:

- **An answer** is compared in depth to the row held: a revalidation returning
  the same rows keeps every one of them — though parsed JSON makes every nested
  object a new one — and their readers stay still.
- **A relation** changes its row when the row points at other children; the
  children themselves are followed through the relation — `game.place.label`
  read in a render re-renders it when the place is written, and the game row
  stays the one it was.
- **A value written with `store.upsert()`** is compared by reference: a new
  object is a change, whatever it holds.

## Relations: pick one of the four methods

A backend sub-route (`/games/:id/candidates`, `/games/:id/candidates/:userId/seen`)
is a relation. Model it with a relationship method. Do **not** encode it as an
`op`/`type` discriminator inside a single verb's callback:

```js
// ✗ the anti-pattern this page exists to prevent
PATCH: ({ id, op, ...rest }) => {
  if (op === "candidate") return fetchJson(`/games/${id}/candidates`, …);
  if (op === "score") return fetchJson(`/games/${id}/score`, …);
  …
};
```

One verb dispatching on a string gives up everything the store does for you:
per-operation action state (loading/error per button), per-relation autorerun,
and a child collection that other components can read. The same smell wears a
second coat: a verb on one relation carrying an id from a **different** relation
— a `group_id` sent to the game × user shares, which the server expands into
people — is two relations spelled as one, and the one the gesture is about
(game × group) ends up with no rows and nothing for its row on screen to read.

| Situation                                                                                                     | Use                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| The child is a first-class entity with its own store, shared across parents (a user referenced by many games) | `.one()` / `.many()`                                                                                                                |
| The child only exists inside its owner, with no identity outside it (a game's candidates, a table's columns)  | `.scopedOne()` / `.scopedMany()`                                                                                                    |
| The relation itself carries fields (`candidate_since`, `seen_at`, `slot`)                                     | `.scopedMany()` — those fields belong to the pair; putting them in a shared child store corrupts that entity for every other reader |
| The backend answers every sub-route with the whole refreshed parent                                           | still model the relation; absorb the response with a plural callback (see below)                                                    |
| A genuine partial update of the parent itself (cancel a game)                                                 | plain `PATCH` on the parent                                                                                                         |

Singular vs plural is about the relation, not the verb: `.one`/`.scopedOne` for a
single sub-object, `.many`/`.scopedMany` for a collection.

**A write whose effect the response does not carry is a modelling bug, not a
case for the client to remember.** The row on screen claiming "this happened"
reads the store, which holds only what responses carried; whatever the screen
memorizes instead lives on the client and dies with the session — reload, and
the row confidently claims the write never happened. The fix is on the shape —
give that relation its own relationship method and a callback returning what was
written, even when the backend must grow a field for it — never a flag next to
the button.

## Callback return contracts

These are not guessable — each relationship method has its own shape, written
out with an example in its JSDoc:

- **`.one(propertyName, CHILD, { GET, PUT, DELETE })`** — `GET`/`PUT` return
  the **parent** with the child nested inside (`{ id, session: { id: 10 } }`,
  `session: null` for none); `DELETE` the parent id, or `{ id }`. A parent
  `GET`/`POST` that embeds the child inline works too.
- **`.many(propertyName, CHILD, callbacks)`** — `GET_MANY` returns the
  **parent** with the array nested inside; `GET`/`POST`/`PUT`/`PATCH` the
  **child**, upserted into the child store but not joining the parent's array,
  which only a `GET_MANY` rewrites; `DELETE` `[parentId, childId]`,
  `DELETE_MANY` `[parentId, [childId, …]]`.
- **`.scopedOne(propertyName, callbacks)`** — every callback returns
  `[ownerId, props | null]`; the property is `null` until one does.
- **`.scopedMany(propertyName, { idKey, … })`** — `[ownerId, props]`; `PUT` (an
  id rename) `[ownerId, oldId, props]`; `DELETE` `[ownerId, childId]`; any
  `*_MANY` `[ownerId, itemArray]`, which replaces the whole collection;
  `DELETE_MANY` `[ownerId, [childId, …]]`. `idKey` names the child's own key
  inside its owner (`"id"` by default).

`ownerId` may be `{ [uniqueKey]: value }` when the owner is known by an
alternate key. A scoped child takes relations of its own —
`TABLE_COLUMNS.one("dataType", DATA_TYPE)`, fed by what the columns' callbacks
embed — but none of the callbacks whose result names the child by itself
(`.one()`'s `GET`/`PUT`/`DELETE`, `.many()`'s `GET_MANY`/`DELETE`/`DELETE_MANY`,
every scoped callback): a column exists only inside its table, and two tables
can each have an `email`. Declaring one throws.

## When the backend answers a sub-route with the whole parent

This is the common REST shape, and it is the reason `op` dispatch feels
attractive: a full-parent response absorbs into a parent `PATCH` with no
thinking. Model the relation anyway and absorb the response in the callback —
**any `*_MANY` callback replaces the collection wholesale**: the rows the store
keeps for that owner, not what some other action reading the same resource is
showing (see [Searching the same collection](#searching-the-same-collection)).

```js
const GAME_CANDIDATES = GAME.scopedMany("candidates", {
  idKey: "user_id",
  GET_MANY: async ({ id }) => {
    const game = await fetchJson(`/games/${id}/candidates`);
    return [game.id, game.candidates];
  },
  // the backend returns the refreshed game, not the created candidate:
  // POST_MANY resyncs the collection from it in one shot
  POST_MANY: async ({ id, ...body }) => {
    const game = await fetchJson(`/games/${id}/candidates`, {
      method: "POST",
      body,
    });
    return [game.id, game.candidates];
  },
});
```

For `.many()`, the equivalent is its `GET_MANY` callback, which already takes
the parent object with the array nested inside — return the response untouched.
Deletion is the exception: `DELETE`/`DELETE_MANY` drop by id rather than
replace, so return `[ownerId, deletedId]` from the id you already have in the
params, and ignore the full parent the backend sent back.

The parent's own fields in such a response (a `status`, a `score`) are applied
only where the callback returns the parent: `.one()`'s `GET`/`PUT` and
`.many()`'s `GET_MANY` upsert it whole, fields included. A scoped relation's
callback writes the relation alone — if the parent's own fields change too,
either let the parent `GET` rerun (below) or `store.upsert()` the parent
explicitly.

## Relations and autorerun

Relationship mutations do **not** invalidate their parent by default. The rules:

- `.scopedMany` child **POST** reruns the owner's singular `GET`, whether it
  goes through the child or through a `withParams()` scope of it — but only when
  the last GET response actually embedded that property. GET_MANY on the parent
  is never rerun by a child POST (a list of parents is not stale because one of
  them gained a child).
- `.scopedMany` child **PUT / PATCH / DELETE** rerun nothing: the callback result
  already carries the updated child.
- `.scopedOne` mutations rerun nothing, ever — the result is the new value.
- `.one` / `.many` children live in an independent store; mutating them never
  reruns the parent. Declare it with
  [`dependencies`](#dependencies-rerun-after-another-resource-writes) if you
  need it.
- Within a relationship resource, the usual defaults still apply: its own
  `GET_MANY` reruns after its own `POST`. A `.one`/`.many` `GET` is reset (not
  rerun) by its own `DELETE`, as a root `GET` is; a scoped `GET` is not reset —
  its data resolves to nothing once the child is dropped. Every relationship
  method accepts `rerunOn`/`dependencies`; what a relation leaves out is its
  parent resource's (`rerunOn` key by key).

Splitting a sub-resource out of a parent `PATCH` therefore changes the refresh
graph: a parent field the parent's own response kept fresh is, once the relation
is a resource of its own, refreshed only by these rules. When a parent field
depends on a child mutation, say so with `dependencies` rather than relying on a
rerun that will not happen.

## `withParams()`: a scope with reruns of its own

A resource reruns its own reads after its own writes (`rerunOn`, see
[list_refresh.md](./list_refresh.md#rerunon-verb-by-verb)), and it does so for
every read of the resource: a `POST` reruns every `GET_MANY` that completed,
whatever params each one was bound to. Right for one collection, wrong for a
resource read under several fixed questions at once — the admins and the guests
of one `USER`, each list on its own screen. A guest created should not send the
admin list back to the network.

`withParams()` binds params into every action of the resource and gives the
result a rerun scope of its own:

```js
const ADMIN = USER.withParams({ role: "admin" });
const GUEST = USER.withParams({ role: "guest" });

await ADMIN.GET_MANY.run(); // GET_MANY({ role: "admin" })
await GUEST.GET_MANY.run();
await ADMIN.POST({ name: "Bob" }); // reruns ADMIN.GET_MANY, and nothing else
```

The isolation is complete, in both directions: a write on `ADMIN` reaches no
read of `GUEST` and no read of `USER` itself, and a write on `USER` reaches no
read of either scope. What the scopes still share is the **store**: an item
updated through one is the same object in the others, so the fields of a row
change everywhere without a request — only the membership of each list is a
question its own scope answers.

**A scope is the object `withParams()` returned, not its params.** Each call
builds one of its own: two `USER.withParams({ role: "admin" })` written in two
files do not reach each other, and neither do
`USER.withParams({ role: "admin" }).withParams({ gender: "male" })` and
`USER.withParams({ role: "admin", gender: "male" })`, though they bind the same
params. Declare each scope once, and import it.

It scopes a relation as well, keeping the relation's return contract
(`TABLE_COLUMNS.withParams({ withTypes: true }).GET_MANY` replaces that table's
columns). Its second argument takes `rerunOn` and `dependencies` for that scope;
what it leaves out is the resource's — a `rerunOn` key by key, so
`{ rerunOn: { GET: ["PATCH"] } }` keeps the resource's `GET_MANY` and
`GET_RANGE`. Empty params throw: a scope has to be about something.

It is not the tool for a param the user types: a search word bound with
`withParams()` would keep its results from refreshing after a write on the
resource, where a `bindParams` on the resource's own `GET_MANY` stays in the
rerun graph ([Searching the same collection](#searching-the-same-collection)).
`withParams()` is for a scope the code fixes once — a role, a status, a tenant.

### `dependencies`: rerun after another resource writes

A resource whose reads depend on what another resource holds — roles answered
with their owners, where an owner is a database or a table — says so with
`dependencies`, on the resource or on a scope of it:

```js
const ROLE_WITH_OWNERS = ROLE.withParams(
  { owners: true },
  { dependencies: [DATABASE, TABLE] },
);
```

Any write on a listed resource (`POST`, `PUT`, `PATCH`, `DELETE`) reruns the
completed `GET` and `GET_MANY` of the resource that declared it, and invalidates
its `GET_RANGE` readers when the verb is in its `rerunOn.GET_RANGE`. A
dependency is a facade: `DATABASE` and `DATABASE.withParams(…)` are two of them,
and only writes on the one listed count. Nothing goes the other way, and nothing
is inferred — a relation that really is a sub-route of the parent is modelled
with the relationship methods ([above](#relations-and-autorerun)), never
declared as a dependency.

## A function calling the verb, or the instance

Both forms are real, and what separates them is narrower than it looks:

```jsx
// a function that calls the verb — the nominal form
<Button action={() => GAME_CANDIDATES.POST({ id: game.id, user_id })}>
  Accept
</Button>

// the instance, bound to its params
<Button action={GAME_CANDIDATES.POST.bindParams({ id: game.id, user_id })}>
  Accept
</Button>
```

Either way the button is busy while the write runs and shows the error if it
fails; either way what runs inside is the same resource run, so the store is
updated, the actions this mutation invalidates rerun the same, and a failure
fails the action around it
([error_handling.md](./error_handling.md#what-a-failing-action-does)). But a
function is wrapped into an action of its own, one with no verb, and the
instance carries two things that wrapper does not:

- **identity.** Everyone binding the same params holds one instance, so a run
  started in one place is visible from another. Reach for it when something else
  on screen has to see this very run — a user row in a side explorer going
  loading while the main page renames that user, two affordances for the same
  delete that must both go busy at once. Nothing else in the stack answers that
  question: the store holds the data, not who is currently writing it.
- **the verb** (`meta.verb`). Under a [network policy](./network_policy.md), a
  control holding a write verb's instance — or sitting in a `<Form>` holding one
  — is read-only before the press and says why. The function form is not seen:
  the press is accepted, and the write fails after it with a
  `NetworkPolicyError`.

Where neither pays — one affordance, in one place, that nobody else watches, and
no network policy to hold the write — a `bindParams({ id })` written per row
builds an identity nothing reads, and a plain function says the gesture more
directly. Either way, what to READ afterwards is the store, or the instance that
ran — never the verb, whose signals hold only a run made on the verb itself, with
no params ([actions.md](./actions.md#the-answer-is-kept-on-the-instance-that-ran)).

What genuinely loses what a resource gives is neither of those two, but a
callback that goes around the verb:

```jsx
// ✗ no resource run at all: nothing updates the store, nothing is invalidated
<Button
  action={() => fetch(`/games/${game.id}/candidates`, { method: "POST" })}
>
  Accept
</Button>
```

## See also

- [list_refresh.md](./list_refresh.md) — what re-runs after a write, and what
  stays on screen while it does
- [actions.md](./actions.md) — action lifecycle, `bindParams`, `useAsyncData`
- [network_policy.md](./network_policy.md) — what the store already keeps when
  the network is gone, and the policy that keeps requests from going out
