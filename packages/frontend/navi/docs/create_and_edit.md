# Creating a resource, then editing it

The loop almost every application has: a screen that creates something, the page
of the thing just created, and a screen that edits it. It is worth a page of its
own because the delicate part is not the form — it is that **the edit screen
fills itself a request after it opened**, and that the two screens are the same
form asked to behave differently.

Working example:
[../src/control/demos/integration/4_create_then_edit_demo.html](../src/control/demos/integration/4_create_then_edit_demo.html)
— the whole loop, with a backend on the page answering by hand so the loading
and the failures can be looked at.

- [The routes](#the-routes)
- [The resource](#the-resource)
- [One form, two modes](#one-form-two-modes)
- [Filling the edit form, and what it is measured against](#filling-the-edit-form-and-what-it-is-measured-against)
- [Where each screen goes next](#where-each-screen-goes-next)
- [Movement between them](#movement-between-them)

## The routes

Four places, and each of them is a url someone can open, reload or share:

```js
const HOME_ROUTE = route("/");
const NEW_GAME_ROUTE = route("/games/new", {
  searchParams: {
    name: nameSignal,
    level: levelSignal,
    players: playersSignal,
  },
});
const GAME_ROUTE = route("/games/:gameId");
const EDIT_GAME_ROUTE = route("/games/:gameId/edit");
setupRoutes([HOME_ROUTE, NEW_GAME_ROUTE, GAME_ROUTE, EDIT_GAME_ROUTE]);
```

The create screen declares its fields as **search params**: a draft that
survives a reload and travels in a link. The edit screen declares none — its
values belong to the resource, not to the position.

Two facts about matching decide the rest, and both surprise:

- **Several routes match at once.** A route matches by prefix, so `/` is still
  matching on `/games/2/edit`, and `/games/new` is also a `/games/:gameId`.
  That is what keeps a section active while one is inside it.
- **The first matching branch wins**, in the order the `<Route>` children are
  written. So they go from the most precise to the widest:

```jsx
<Route>
  <Route route={EDIT_GAME_ROUTE} element={EditGamePage} />
  <Route route={NEW_GAME_ROUTE} element={NewGamePage} />
  <Route route={GAME_ROUTE} element={GamePage} />
  <Route route={HOME_ROUTE} element={HomePage} />
</Route>
```

Same thing for what a route LOADS: the loader of `/games/:gameId` must step
aside on `/games/new`, which is a page and not a game.

```js
const GAME_OF_ROUTE = routeAction(
  [GAME_ROUTE, EDIT_GAME_ROUTE],
  GAME.GET,
  () => {
    if (NEW_GAME_ROUTE.matchingSignal.value) {
      return null; // "new" is not an id
    }
    const gameId =
      GAME_ROUTE.paramsSignal.value.gameId ||
      EDIT_GAME_ROUTE.paramsSignal.value.gameId;
    return gameId ? { id: gameId } : null;
  },
);
```

## The resource

Declare the REST callbacks once ([resource.md](./resource.md)) and the store
does the rest — this is what makes the detail page show the new name **the
moment the PUT answers**, with nobody reloading anything:

```js
const GAME = resource("game", {
  GET: ({ id }) => api.readGame(id),
  GET_MANY: () => api.readGames(),
  POST: (values) => api.createGame(values),
  PUT: ({ id, ...values }) => api.updateGame(id, values),
});
```

Two things to know or the screen stays empty:

- **Reading an action does not start it.** `useAsyncData` waits for data
  someone else asked for; what asks is the route (`routeAction`). A component
  reading an action nobody runs suspends forever, and the whole `<Loading>`
  subtree stays blank.
- **Handle the error where it happens**, or hand it to an `<ErrorBoundary>`:
  `useAsyncData(action, { loading: true, error: true })` returns
  `[data, loading, error]`, which is what lets a page draw its own "the server
  refused" with a "try again" that calls `action.rerun()`.

## One form, two modes

The same fields, filled by nothing (create) or by a resource (edit). Two shapes,
and the choice is about maintenance, not about navi:

- **One component for both** — one place to change when a field is added. The
  price: it must handle the mode where the values arrive late.
- **One dumb form, two screens around it** — the create screen hands it empty
  values, the edit screen hands it the loaded ones and shows the loading state
  itself. The form then never knows about loading at all.

The second is cleaner and the first is what most screens end up being. Either
way the fields are bound to signals ([control_value.md](./control_value.md)) and
what follows applies.

## Filling the edit form, and what it is measured against

The edit screen opens, and the resource arrives after it. Whoever fills the
fields must also say **when the filling is done**, because that is the moment
the form's reference is taken — without it the screen opens already changed, and
pressing Save sends back what was just loaded:

```jsx
const [filled, setFilled] = useState(false);
useEffect(() => {
  if (!game) {
    return;
  }
  nameSignal.value = game.name;
  levelSignal.value = game.level;
  playersSignal.value = game.players;
  setFilled(true);
}, [game]);

<Form pristineKey={filled ? game.id : undefined} action={…}>
```

`pristineKey` is the whole subject of [form_changed.md](./form_changed.md) —
including why a form with nothing new sends nothing, and why there is no tick to
wait for before setting the flag.

## Where each screen goes next

The two screens navigate for opposite reasons, and that is why they say it in
two different places:

- **Create**: the page to land on is the one the server just made, and its id
  comes back with the response. Nothing can be declared before the send, so the
  action navigates:

  ```jsx
  <Form
    action={async (values) => {
      const game = await GAME.POST.bindParams(values).rerun();
      GAME_ROUTE.navTo({ gameId: game.id });
    }}
  >
  ```

- **Edit**: the destination is known before the send — and it has to be, because
  a press with **nothing to send** must leave too. That is `command`, which runs
  whether or not there was an action to run:

  ```jsx
  <Form
    pristineKey={filled ? game.id : undefined}
    command={`--navi-nav-to:${GAME_ROUTE.buildUrl({ gameId: game.id })}`}
    action={(values) => GAME.PUT.bindParams({ id: game.id, ...values }).rerun()}
  >
  ```

  Do not hold that submit back with `readOnlyWhileFormUnchanged`: the press
  still does something — it leaves.

## Movement between them

The three screens are places, so the movement between them is
`RouteTravel` — not `SlideContainer`, which is for positions with no url (see
[navigation.md](./navigation.md#tabs-with-no-url)).

Its children are ordered by matching precision (above), and the order of the
**journey** is another thing entirely — so it is said apart:

```jsx
<RouteTravel
  routes={[HOME_ROUTE, NEW_GAME_ROUTE, EDIT_GAME_ROUTE, GAME_ROUTE]}
>
```

Creating and editing sit to the left of the game, so arriving on the game goes
right ("here is what I just did") and going back to edit goes left. The gesture,
the back button and a link pressed all move the same way.

## See also

- [form_changed.md](./form_changed.md) — what a form sends, what follows a send
- [navigation.md](./navigation.md) — routes, links, travelling
- [resource.md](./resource.md) — the store behind GET/POST/PUT
- [control_value.md](./control_value.md) — binding fields to signals
