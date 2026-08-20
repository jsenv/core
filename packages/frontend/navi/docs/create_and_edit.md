# Creating a resource, then editing it

The loop almost every application has: a screen that creates something, the page
of the thing just created, and a screen that edits it. It is worth a page of its
own because what makes it hard is not the form — it is that **the two screens
look like the same form and are not the same thing at all**: one holds a draft
the person is writing, the other holds a resource the server owns.

Working example:
[../src/control/demos/integration/create_then_edit/create_then_edit.html](../src/control/demos/integration/create_then_edit/create_then_edit.html)
— the whole loop, with a backend on the page answering by hand so the loading
and the failures can be looked at.

- [What the loop owes the person](#what-the-loop-owes-the-person)
- [The routes](#the-routes)
- [The resource](#the-resource)
- [Two screens, two states](#two-screens-two-states)
- [The edit screen opens filled](#the-edit-screen-opens-filled)
- [Where each screen goes next](#where-each-screen-goes-next)
- [Movement between them](#movement-between-them)

## What the loop owes the person

The rules below are what the rest of this page is for. Each one is a decision
about what the person is owed, not about navi.

- **Creating lands on what was created.** Going back to the list after a
  creation asks the person to find their own thing to be sure it exists; the
  thing itself is the proof, and it is also where they were heading.
- **A draft is theirs until it is sent, and not a minute longer.** Half a form
  filled must survive a reload (it is in the url), and must be gone the next
  time "create" is opened — a create screen showing the last thing created is a
  screen nobody trusts.
- **Saving goes back to the thing, and so does a press that had nothing to
  send.** The person is done either way; refusing to move because "nothing
  changed" makes them press again to find out why.
- **Cancelling puts back what the server says**, not what was typed and
  abandoned. What leaving with unsaved changes does is a decision each screen
  takes: dropping them is right when they are a few fields the person chose to
  leave (that is what the shape below does, for free — the screen is thrown
  away), and worth a confirmation when they are half an hour of work.
- **What was written shows up everywhere at once.** A name changed on one screen
  and stale on the list two seconds later reads as data loss.
- **A failure is shown where the thing was asked for**, with what was typed
  still there: an error on a form that emptied itself is worse than the failure.
- **Every screen is a url.** Reload, back, a link sent to someone — the screens
  of this loop are places, and the movement between them says how they are
  related.

Each of them has a mechanism below, and each mechanism is a line of code, not a
framework.

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
- **The first that matches wins**, in the order it is written — the `<Route>`
  children, and the pages of a travel row alike. So they go from the most
  precise to the widest:

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

## Two screens, two states

The same three fields, and two different things behind them:

- the **create** screen holds a **draft** — nobody else's, not saved anywhere,
  worth keeping while it is being written. It belongs in the url
  (`searchParams`), which is what makes it survive a reload and travel in a
  link;
- the **edit** screen holds a **resource** — the server's, loaded, and the
  screen is a way of proposing changes to it.

Write the fields once and give them their source:

```jsx
const fieldSource = (game, key, signal) =>
  game ? { value: game[key] } : { signal };

const GameFormFields = ({ game }) => (
  <>
    <Input name="name" {...fieldSource(game, "name", nameSignal)} required />
    <Select name="level" {...fieldSource(game, "level", levelSignal)}>
      …
    </Select>
  </>
);
```

**Do not let the two share one set of signals.** It is the mistake this shape
exists to prevent, and it does not look like a mistake: bind both screens to the
same `nameSignal`, edit a game, then press "create" — the game you just edited
is sitting in the create form, in the url. The draft and the resource are not
the same state; one is on the screen, the other is at the backend.

The draft's other half is the end of its life:

```jsx
action={async (values) => {
  const game = await GAME.POST.bindParams(values).rerun();
  nameSignal.value = undefined; // le brouillon a servi
  levelSignal.value = undefined;
  GAME_ROUTE.navTo({ gameId: game.id });
}}
```

`undefined`, not `""`: a state signal put back to undefined returns to its
default and leaves the url — see [control_value.md](./control_value.md).

## The edit screen opens filled

Render the form only once the resource is there, and everything below follows
from it:

```jsx
if (loading && !game) {
  return <Skeleton />;
}
return (
  <Form action={…}>
    <GameFormFields game={game} />
  </Form>
);
```

- the fields are **given** their values, so the form holds them from its first
  render: what it is measured against is right without anyone saying so, and
  pressing Save without touching anything sends nothing (see
  [form_changed.md](./form_changed.md));
- cancelling is a link away — the screen is thrown away with what was typed in
  it, and coming back re-reads the resource. There is nothing to "restore";
- after a successful PUT the store holds the new values, the fields are given
  them, and the screen is already showing what was saved.

**When the form must be on screen before its values** — a long screen you do not
want to blank, a form whose fields are filled by several requests landing at
different times — it opens on defaults and is filled later, and then it needs to
be told when the filling is done:

```jsx
<Form pristineKey={filled ? game.id : undefined}>
```

Without it the screen opens **already changed** — its reference was taken while
the fields were still empty — and Save sends back what was just loaded.
`pristineKey` is the subject of [form_changed.md](./form_changed.md); mounting
the form with its values is how not to need it.

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
    command={`--navi-nav-to:${GAME_ROUTE.buildUrl({ gameId: game.id })}`}
    action={(values) => GAME.PUT.bindParams({ id: game.id, ...values }).rerun()}
  >
  ```

  Do not hold that submit back with `readOnlyWhileFormUnchanged`: the press
  still does something — it leaves. Holding it back is for a form that goes
  nowhere, where the press would visibly do nothing at all.

## Movement between them

The screens are places, so the movement between them is `RouteTravel` — not
`SlideContainer`, which is for positions with no url (see
[navigation.md](./navigation.md#tabs-with-no-url)).

A row says two things at once, and they are said apart. Its `<Route>` children
are ordered by matching precision (above); `routes` is the order of the
**journey** — what "one step that way" means:

```jsx
<RouteTravel routes={[NEW_GAME_ROUTE, GAME_ROUTE]}>
```

Creating sits to the left of the game, so arriving on what was just created goes
right ("here is what I just made"). **A page left out of `routes` does not
travel at all**: the list is not a step along this row — one opens the create
screen from it, one does not slide there — so it is absent, and that move has no
animation. Leaving a page out is how a movement is refused; there is no "no
transition" to ask for.

A pair with a movement of its own gets a row of its own, on its own axis. The
game and its edit screen are the same thing seen two ways, so they travel
vertically inside the position the outer row holds for them:

```jsx
const GameArea = () => (
  <RouteTravel axis="y" routes={[EDIT_GAME_ROUTE, GAME_ROUTE]}>
    <Route>
      <Route route={EDIT_GAME_ROUTE} element={EditGamePage} />
      <Route route={GAME_ROUTE} element={GamePage} />
    </Route>
  </RouteTravel>
);
```

Editing sits above the game on that column, so it comes down over it and saving
sends it back up. The outer row does not move for it: both urls are the same position
there, which is what makes the two rows independent —

```jsx
<Route route={EDIT_GAME_ROUTE} element={GameArea} />
<Route route={GAME_ROUTE} element={GameArea} />
```

— the same element on both branches, so the inner row stays mounted across the
two and has something to travel between.

The gesture, the back button and a link pressed all move the same way.

## See also

- [form_changed.md](./form_changed.md) — what a form sends, what follows a send
- [navigation.md](./navigation.md) — routes, links, travelling
- [resource.md](./resource.md) — the store behind GET/POST/PUT
- [control_value.md](./control_value.md) — binding fields to signals
