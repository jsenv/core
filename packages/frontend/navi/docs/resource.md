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
`<Button action>`, …) — see [actions.md](./actions.md).

## `store.upsert()` is not how data enters the store

navi writes the store. Declare the resource and its relations, return the shape
each callback owes (tables above and below), and the write happens. A hand
written `store.upsert()` in the path of a normal request of the resource is the
sign that something is missing: a relation that is not declared, or a callback
that does not return what it should.

`store` is exposed for what is **not** a request of the resource, where writing
it yourself is the point:

- seeding it with data that came from elsewhere — state rendered by the server,
  a local cache, a websocket message;
- absorbing the parent object a relation route answered with: the relation
  callback only writes the relation, so the parent's own fields have nowhere
  else to land (see [When the backend answers a sub-route with the whole
  parent](#when-the-backend-answers-a-sub-route-with-the-whole-parent)).

A list that loads its rows a slice at a time is **not** one of those cases — that is
`GET_RANGE`, right below.

## `GET_RANGE`: feeding a list that loads as it scrolls

A `<List.Items>` asks for the rows it is about to draw and keeps what it gets.
`GET_RANGE` is the resource's answer to that question — one slice at a time:

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
(`start`, `end`, `limit`, `before`, `after`, `around`, `count`), and a `signal`
as second argument — aborted when the list stops wanting those rows. It returns
a range the way a `Content-Range` does: **`{ items, start, count }`** — these
rows, at this place, out of that many. `start` may be omitted when the list
asked for a positive one; `count` defaults to `start + items.length` (a source
that does not know its total). The items are upserted on their way in, so the
list draws store items — never copies of the JSON — and a request sent from a
row is read back on that row.

A row that must follow its **own fields** through a write reads them from the
store rather than from the object it was handed:

```jsx
const GameCard = ({ id }) => {
  const game = GAME.useById(id); // the item as it is now
  …
};
```

An update replaces the item object (the store holds values, and that is what
makes a change detectable), so the one the list is holding is the one it was
given. Relations are not concerned: they are keyed by owner, and a row reading
`game.candidates` reads the shared collection whatever object carries it.

`GET_RANGE` is a **reader, not an action**. It keeps no value and takes no place
in the rerun graph, which is what makes it usable per slice:

- the list already holds the slices it received and glues them back together —
  a second memory holding one of them would fight it;
- a `POST` invalidating "the collection" would otherwise send every slice ever
  loaded back to the network at once.

What it does not give is membership: an item that leaves the collection stays on
screen until the rows are asked for again. Give the screen its own way to ask
(a refresh gesture, a `key` on the run).

It reads a collection, so it lives on the resource itself (or on a
`withParams()` of it), not on a relation.

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
and a child collection that other components can read.

| Situation                                                                                                     | Use                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| The child is a first-class entity with its own store, shared across parents (a user referenced by many games) | `.one()` / `.many()`                                                                                                                |
| The child only exists inside its owner, with no identity outside it (a game's candidates, a table's columns)  | `.scopedOne()` / `.scopedMany()`                                                                                                    |
| The relation itself carries fields (`candidate_since`, `seen_at`, `slot`)                                     | `.scopedMany()` — those fields belong to the pair; putting them in a shared child store corrupts that entity for every other reader |
| The backend answers every sub-route with the whole refreshed parent                                           | still model the relation; absorb the response with a plural callback (see below)                                                    |
| A genuine partial update of the parent itself (cancel a game)                                                 | plain `PATCH` on the parent                                                                                                         |

Singular vs plural is about the relation, not the verb: `.one`/`.scopedOne` for a
single sub-object, `.many`/`.scopedMany` for a collection.

## Callback return contracts

These are not guessable — each relationship method has its own shape.

### `.one(propertyName, childResource, { GET, PUT, DELETE })`

The callback returns the **parent** object with the child nested inside:

```js
const USER_SESSION = USER.one("session", SESSION, {
  GET: async ({ id }) => {
    const session = await fetchJson(`/users/${id}/session`);
    return { id, session }; // { id, session: { id: 10, token: "abc" } }
  },
  DELETE: async ({ id }) => {
    await fetchJson(`/users/${id}/session`, { method: "DELETE" });
    return id; // property becomes null
  },
});
```

`session: null` in the returned parent means "no relation". A parent GET/POST
that embeds the child inline works too — the property setter upserts it.

### `.many(propertyName, childResource, restCallbacks)`

GET_MANY returns the **parent** object with the array nested inside; DELETE
returns the pair of ids:

```js
const USER_FRIENDS = USER.many("friends", USER, {
  GET_MANY: async ({ id }) => {
    const friends = await fetchJson(`/users/${id}/friends`);
    return { id, friends }; // { id, friends: [{ id: 2 }, { id: 3 }] }
  },
  POST: async ({ id, friendId }) =>
    fetchJson(`/users/${id}/friends`, { method: "POST", body: { friendId } }),
  DELETE: async ({ id, friendId }) => {
    await fetchJson(`/users/${id}/friends/${friendId}`, { method: "DELETE" });
    return [id, friendId]; // [parentId, childId]
  },
  DELETE_MANY: async ({ id, friendIds }) => {
    await fetchJson(`/users/${id}/friends`, {
      method: "DELETE",
      body: { friendIds },
    });
    return [id, friendIds]; // [parentId, [childId, …]]
  },
});
```

The singular POST/PUT/PATCH callbacks return the **child** object. It is upserted
into the child store, but it does not join the parent's array on its own: the
array is the backend's, and only a GET_MANY refresh rewrites it.

### `.scopedOne(propertyName, { idKey, GET, POST, PUT, PATCH, DELETE })`

Every callback returns `[ownerId, props | null]`:

```js
const USER_PROFILE = USER.scopedOne("profile", {
  GET: async ({ id }) => [id, await fetchJson(`/users/${id}/profile`)],
  PATCH: async ({ id, ...props }) => [
    id,
    await fetchJson(`/users/${id}/profile`, { method: "PATCH", body: props }),
  ],
  DELETE: async ({ id }) => {
    await fetchJson(`/users/${id}/profile`, { method: "DELETE" });
    return [id, null];
  },
});
```

The property is `null` until a callback provides data. `ownerId` may be
`{ [uniqueKey]: value }` when the owner is known by an alternate key rather than
its id.

### `.scopedMany(propertyName, { idKey, GET, GET_MANY, POST, PUT, PATCH, DELETE, … })`

Every callback returns `[ownerId, ...rest]`:

```js
const GAME_CANDIDATES = GAME.scopedMany("candidates", {
  idKey: "user_id",
  GET_MANY: async ({ id }) => [id, await fetchJson(`/games/${id}/candidates`)],
  POST: async ({ id, ...body }) => [
    id,
    await fetchJson(`/games/${id}/candidates`, { method: "POST", body }),
  ],
  PUT: async ({ id, oldUserId, ...props }) => [id, oldUserId, props], // id rename
  DELETE: async ({ id, user_id }) => {
    await fetchJson(`/games/${id}/candidates/${user_id}`, { method: "DELETE" });
    return [id, user_id];
  },
});
```

| Callback           | Returns                                                |
| ------------------ | ------------------------------------------------------ |
| GET / POST / PATCH | `[ownerId, props]`                                     |
| PUT (id rename)    | `[ownerId, oldId, props]`                              |
| DELETE             | `[ownerId, childId]`                                   |
| any `*_MANY`       | `[ownerId, itemArray]` — replaces the whole collection |
| DELETE_MANY        | `[ownerId, [childId, …]]`                              |

`idKey` names the child's own key inside its owner (`user_id` above); it defaults
to `"id"`.

## When the backend answers a sub-route with the whole parent

This is the common REST shape, and it is the reason `op` dispatch feels
attractive: a full-parent response absorbs into a parent `PATCH` with no
thinking. Model the relation anyway and absorb the response in the callback —
`resource()` gives a plural callback for exactly this: **any `*_MANY` callback
replaces the collection wholesale**.

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

For `.many()`, the equivalent is its GET_MANY callback, which already takes the
parent object with the array nested inside — return the response untouched.

Deletion is the exception: `DELETE`/`DELETE_MANY` drop by id rather than replace,
so return `[ownerId, deletedId]` using the id you already have in the params,
and ignore the full parent the backend sent back.

Fields of the parent that come back in such a response (a `status`, a `score`)
are not applied by the relation callback — it only writes the relation. If the
parent's own fields change too, either let the parent GET rerun (see below) or
`store.upsert()` the parent explicitly.

## Relations and autorerun

Relationship mutations do **not** invalidate their parent by default. The exact
rules, verified by `src/state/rest/tests/resource_graph_parent_rerun.test.js`:

- `.scopedMany` child **POST** reruns the owner's singular `GET` — but only when
  the last GET response actually embedded that property. GET_MANY on the parent
  is never rerun by a child POST (a list of parents is not stale because one of
  them gained a child).
- `.scopedMany` child **PUT / PATCH / DELETE** rerun nothing: the callback result
  already carries the updated child.
- `.scopedOne` mutations rerun nothing, ever — the result is the new value.
- `.one` / `.many` children live in an independent store; mutating them never
  reruns the parent. Declare it explicitly with `dependencies` if you need it
  (see [resource_dependencies.md](./resource_dependencies.md)).
- Within a relationship resource, the usual defaults still apply: its own
  `GET_MANY` reruns after its own `POST`; its `GET` is reset (not rerun) by its
  `DELETE`. Override per relation with `rerunOn`/`dependencies`, which every
  relationship method accepts.

Splitting a sub-resource out of a parent `PATCH` therefore changes the refresh
graph: what used to be refreshed by the parent's own response is now refreshed
only by these rules. When a parent field genuinely depends on a child mutation,
say so with `dependencies` rather than relying on a rerun that will not happen.

## Binding params instead of wrapping in an arrow

Every action exposes `bindParams()`, which returns an action instance with its
own state. Pass that instance to a component:

```jsx
// ✓ loading, error and disabled states come for free
<Button action={GAME_CANDIDATES.POST.bindParams({ id: game.id, user_id })}>
  Accept
</Button>
```

```jsx
// ✗ an inline arrow throws away the per-params action state
<Button
  action={async () => {
    await acceptCandidate(game.id, user_id);
  }}
>
  Accept
</Button>
```

The arrow works, but nothing tracks it: no per-row spinner, no error surfaced on
the button that caused it, no deduplication of concurrent runs, no autorerun of
the actions this mutation should invalidate. See [actions.md](./actions.md).

Away from a component, where the run is a gesture and not something to render,
an action is callable: `GAME.DELETE({ id })` is
`GAME.DELETE.bindParams({ id }).rerun()`.

## See also

- [resource_with_params.md](./resource_with_params.md) — `withParams()` and
  isolated lifecycles
- [resource_dependencies.md](./resource_dependencies.md) — cross-resource
  autorerun
- [list_refresh.md](./list_refresh.md) — what re-runs after a write, and what
  stays on screen while it does
- [actions.md](./actions.md) — action lifecycle, `bindParams`, `useAsyncData`
