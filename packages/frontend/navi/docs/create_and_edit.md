# Creating a resource, then editing it

The loop almost every application has: a screen that creates something, the page
of the thing just created, and a screen that edits it. What makes it hard is not
the form — it is that **the two screens look like the same form and are not the
same thing at all**: one holds a draft the person is writing, the other holds a
resource the server owns.

Working example:
[../src/control/demos/integration/create_then_edit/create_then_edit.html](../src/control/demos/integration/create_then_edit/create_then_edit.html)
— the whole loop, with a backend on the page answering by hand so the loading
and the failures can be looked at.

- [What the loop owes the person](#what-the-loop-owes-the-person)
- [The routes](#the-routes)
- [The resource](#the-resource)
- [Two screens, two states](#two-screens-two-states)
- [The edit screen opens before its values](#the-edit-screen-opens-before-its-values)
- [A field that picks from a list too big to load](#a-field-that-picks-from-a-list-too-big-to-load)
- [Where each screen goes next](#where-each-screen-goes-next)
- [After a write: what goes back to the network](#after-a-write-what-goes-back-to-the-network)
- [Movement between them](#movement-between-them)
- [The same loop in a dialog](#the-same-loop-in-a-dialog)

## What the loop owes the person

Each rule is a decision about what the person is owed, not about navi; the rest
of this page is how it is kept.

- **Creating lands on what was created.** The thing itself is the proof it
  exists, and where the person was heading — not the list, where they would
  have to find it.
- **A draft is theirs until it is sent, and not a minute longer.** It survives a
  reload (it is in the url), and is gone the next time "create" is opened — a
  create screen showing the last thing created is a screen nobody trusts.
- **Saving goes back to the thing, and so does a press that had nothing to
  send.** Refusing to move because "nothing changed" makes the person press
  again to find out why.
- **Cancelling puts back what the server says**, not what was typed and
  abandoned. Dropping unsaved changes is right for a few fields the person chose
  to leave (the shape below does it for free: the screen is thrown away), worth
  a confirmation for half an hour of work — each screen decides.
- **What was written shows up everywhere at once.** A name stale on the list two
  seconds later reads as data loss. Some of that is free (the store), some is a
  request the backend answers (a list after a creation) — see
  [after a write](#after-a-write-what-goes-back-to-the-network).
- **A failure is shown where the thing was asked for**, with what was typed
  still there: an error on a form that emptied itself is worse than the failure.
- **Every screen is a url** — reload, back, a link sent to someone — and the
  movement between them says how they are related.

## The routes

```js
const HOME_ROUTE = route("/");
const NEW_GAME_ROUTE = route("/games/new", {
  searchParams: {
    name: draftNameSignal,
    level: draftLevelSignal,
    players: draftPlayersSignal,
    place: draftPlaceSignal,
  },
});
const GAME_ROUTE = route("/games/:gameId");
const EDIT_GAME_ROUTE = route("/games/:gameId/edit");
setupRoutes([HOME_ROUTE, NEW_GAME_ROUTE, GAME_ROUTE, EDIT_GAME_ROUTE]);
```

The create screen declares its fields as **search params**: a draft that
survives a reload and travels in a link. The edit screen declares none — its
values belong to the resource, not to the position.

`/games/new` is also a `/games/:gameId`, and the first branch that matches wins,
in the order it is written — `<Route>` children and the pages of a travel row
alike — so they go from the most precise to the widest (how a pattern matches:
[navigation.md](./navigation.md#rendering-routes)):

```jsx
<Route>
  <Route route={EDIT_GAME_ROUTE} element={EditGamePage} />
  <Route route={NEW_GAME_ROUTE} element={NewGamePage} />
  <Route route={GAME_ROUTE} element={GamePage} />
  <Route route={HOME_ROUTE} element={HomePage} />
</Route>
```

The loader of `/games/:gameId` steps aside on `/games/new`, which is a page and
not a game:

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
does the rest — the detail page shows the new name **the moment the PUT
answers**, with nobody reloading anything:

```js
const GAME = resource("game", {
  GET: ({ id }) => api.readGame(id),
  GET_MANY: () => api.readGames(),
  POST: (values) => api.createGame(values),
  PUT: ({ id, ...values }) => api.updateGame(id, values),
});
```

Reading an action does not start it — the route does (`routeAction`), and a
component reading an action nobody runs stays blank for good
([actions.md](./actions.md#reading-an-action)). Handle the error where it
happens (`{ loading: true, error: true }` returns `[data, loading, error]`, for
a page drawing its own "try again") or hand it to an `<ErrorBoundary>`
([error_handling.md](./error_handling.md)).

## Two screens, two states

The same fields, and two different things behind them:

- the **create** screen holds a **draft** — nobody else's, not saved anywhere,
  worth keeping while it is being written. It belongs in the url
  (`searchParams`), which is what makes it survive a reload and travel in a
  link;
- the **edit** screen holds **what the server has**, loaded, and proposes
  changes to it: the screen's own state, alive as long as the screen is.

So the fields are written once, know nothing about which screen they are in,
and each screen hands them its own signals:

```jsx
const GameFormFields = ({ nameSignal, levelSignal, loading }) => (
  <>
    <Input name="name" signal={nameSignal} loading={loading} required />
    <Select name="level" signal={levelSignal} loading={loading}>
      …
    </Select>
  </>
);

// create: the draft, which lives in the url
<GameFormFields nameSignal={draftNameSignal} levelSignal={draftLevelSignal} />;

// edit: this screen's own, filled when the game arrives
const nameSignal = useSignal(undefined);
```

**Do not let the two share one set of signals.** It is the mistake this shape
exists to prevent, and it does not look like one: bind both screens to the same
`nameSignal`, edit a game, then press "create" — the game you just edited is
sitting in the create form, and in the url.

The draft's other half is the end of its life:

```jsx
action={async (values) => {
  const game = await GAME.POST.bindParams(values).rerun();
  GAME_ROUTE.navTo({ gameId: game.id });
  draftNameSignal.value = undefined; // it has served
  draftLevelSignal.value = undefined;
}}
```

`undefined`, not `""`: a state signal put back to undefined returns to its
default and leaves the url (see
[control_value.md](./control_value.md#signal--defaultvalue-the-answer-and-where-it-starts)).
**Clear after navigating, not before**: those signals are read by the screen
being left — its list of places is asked for with the place the draft holds —
and emptying them while it is still up asks for that list again, for nobody.

One signal for the whole form works too, when the values arrive as one object
(see [control_value.md](./control_value.md#what-a-signal-holds-control-by-control)).

## The edit screen opens before its values

The resource arrives a request after the screen. Two shapes, both right — the
question is what the person looks at meanwhile.

**The screen waits, showing the form.** The fields are there, empty and busy
(`loading` on a control marks it `aria-busy` and shows it), and fill in when the
resource lands: nothing blinks, and a long screen does not collapse to a
spinner. What it costs is saying **when the filling is done**:

```jsx
const [game, loading, error] = useAsyncData(GAME_OF_ROUTE, {
  loading: true,
  error: true,
  onLoad: (game) => {
    nameSignal.value = game.name;
    levelSignal.value = game.level;
  },
});

<Form pristineKey={game?.id}>;
```

`onLoad` fires once per set of params: a PUT, a list reloading, a poll all hand
the same game back, and copying it again would overwrite what the person is
writing. It fires from a layout effect, so the fields are filled by the time
`pristineKey`, the id itself, takes the reference (see
[actions.md](./actions.md#reading-an-action),
[form_changed.md](./form_changed.md#a-screen-filled-after-it-opened-pristinekey)).
By hand this is a `useEffect` keyed on `game?.id` — `[game]` is the natural,
wrong, thing to write — and a passive effect is too late: the screen opens
**already changed**, and Save sends the resource back untouched.

**Or the screen waits, showing nothing of the form**: a skeleton until the
resource is there, then the form holding its values from its first render —
for a screen that can be blanked without the person losing their place.

Either way, cancelling is a link away: the screen is thrown away with what was
typed in it, and coming back re-reads the resource. There is nothing to restore.

## A field that picks from a list too big to load

A place, a player, a category: the field is a picker whose popup holds **one
page** of what the backend has — the nearest, the most recent, whatever a
`LIMIT` returned. And the screen is pre-filled from the url
(`/games/new?place=halle-des-sports`): a link from a place's page, a back
button, a reload, a shared invitation. The url carries an **identifier and
nothing else**, so the screen looks for it in the list it has —
`places.find((place) => place.id === placeId)` — and nothing guarantees that
`find`: the place may be far down the ranking, created a minute ago, or named in
a link built elsewhere. The screen then shows `halle-des-sports` where it
promised "Halle des sports".

Clearing the signals when the screen opens would throw pre-filling away with its
edge case. The way out that keeps it: **ask for the list SAYING what you already
hold**, and the backend guarantees that item is in the answer, whatever its
rank.

```js
const PLACES_OF_SCREEN = routeAction(
  [NEW_GAME_ROUTE, EDIT_GAME_ROUTE],
  PLACE.GET_MANY,
  // not `() => true`: what the screen already holds must travel with the request
  () => {
    // creating: the url, known at once
    if (NEW_GAME_ROUTE.matchingSignal.value) {
      return { include: draftPlaceSignal.value };
    }
    // editing: it arrives with the resource
    const game = GAME_OF_ROUTE.dataSignal.value;
    return game ? { include: game.placeId } : null;
  },
);
```

Reading the selection in the params also makes the list **reload when the
selection changes**. And the edit screen returns `null` until the resource is
there: asked before knowing what it must contain, the list is asked for twice,
and the first answer cannot show the name.

A paginated list is not "the first N", it is "the first N **plus what the caller
already holds**". On the backend side, `include` is:

- **an addition, not a filter** — the page stays the page, with the asked-for
  item in it once;
- **what a url can hold** — a slug as much as an id;
- **never an error when it designates nothing**: the answer is the page, and the
  screen's "not found" case then says something true (that place is gone)
  instead of being an artefact of pagination;
- **several values** when several fields are pre-filled:
  `GET /users?include=42,57`.

The other half is answered by the resource: **what comes back with a resource
carries its own label**. The game's page shows "Lieu: Halle des sports" with no
list at all, because the GET answers with the name next to the id. Only the url
is reduced to an identifier, and that is where `include` earns its place.

## Where each screen goes next

The two screens navigate for opposite reasons, so they say it in two different
places ([form_changed.md](./form_changed.md#what-follows-a-send)):

- **Create**: the page to land on is the one the server just made, and its id
  comes back with the response, so the action navigates:

  ```jsx
  <Form
    action={async (values) => {
      const game = await GAME.POST.bindParams(values).rerun();
      GAME_ROUTE.navTo({ gameId: game.id });
    }}
  >
  ```

- **Edit**: the destination is known before the send — and has to be, because a
  press with **nothing to send** must leave too. That is `command`:

  ```jsx
  <Form
    command={`--navi-nav-to:${GAME_ROUTE.buildUrl({ gameId: game.id })}`}
    action={(values) => GAME.PUT.bindParams({ id: game.id, ...values }).rerun()}
  >
  ```

  Do not hold that submit back with `readOnlyWhileFormUnchanged`: the press
  still does something — it leaves.

## After a write: what goes back to the network

Creating one game:

```
POST /games     the creation
GET  /games     the list re-reads itself
GET  /games/2   the page of what was just created
```

The list re-reads itself after a `POST` — whether a new item belongs to it is
the backend's to say — and not after a `PUT`, whose values the store carries
into every list holding that item (see
[list_refresh.md](./list_refresh.md#rerunon-verb-by-verb)). **The detail GET is
not saved by the store**: the action for that id had never run, and the store
holding the item is not an action having its data. Nor is it redundant: a
detail representation is richer than what a write answers — here the GET adds
the place's name, and a screen trusting the POST would show "Lieu: —". Skipping
it could only ever be a per-resource decision ("my POST answers the same shape
as my GET").

Coming back to that page later in the session costs **nothing**: a completed
action is not run again for the same params — that, not a cache, opens a visited
screen instantly; `rerun()` is for what must genuinely be read again.

## Movement between them

The screens are places, so the movement between them is `RouteTravel` — not
`SlideContainer`, which is for positions that are not routes
([navigation.md](./navigation.md#tabs-that-are-not-routes)). Its `<Route>`
children are ordered by matching precision (above); `routes` gives the order of
the **journey** ([navigation.md](./navigation.md#tabs-that-travel-routetravel)):

```jsx
<RouteTravel routes={[NEW_GAME_ROUTE, GAME_ROUTE]}>
```

Creating sits to the left of the game, so arriving on what was just created goes
right. **A page left out of `routes` does not travel**: one opens the create
screen from the list, one does not slide there, so the list is absent and that
move plays nothing — leaving a page out is how a movement is refused.

A pair with a movement of its own gets a row of its own, on its own axis. The
game and its edit screen are the same thing seen two ways, so they travel
vertically inside the place the outer row holds for them — editing above
(the column's order is the children's), coming down over the game, sent back up
by saving:

```jsx
const GameArea = () => (
  <RouteTravel axis="y">
    <Route>
      <Route route={EDIT_GAME_ROUTE} element={EditGamePage} />
      <Route route={GAME_ROUTE} element={GamePage} />
    </Route>
  </RouteTravel>
);

// in the outer row: the same element on both branches
<Route route={EDIT_GAME_ROUTE} element={GameArea} />
<Route route={GAME_ROUTE} element={GameArea} />
```

The outer row does not move for it — the edit url is not one of its pages — and
the same element on both branches keeps the inner row mounted, with something
to travel between.

## The same loop in a dialog

Each screen is a url when the thing created is what the person came for. A
**secondary resource** — a radar, a note, a member — is edited without leaving
the page one is reading, so its loop happens in a dialog: the reasoning holds,
only its mechanisms change.

| the page says                                         | the dialog says                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| two routes, `/new` and `/:id/edit`                    | one dialog, two modes — hence the value it is opened ON ([popup_open.md](./popup_open.md#opening-it-on-something)) |
| the draft lives in the `searchParams`                 | it lives in the dialog, and dies with it                                                                           |
| cancelling = leaving the screen, which is thrown away | `mount="while-opened"` (+ a `key` on the form), same effect                                                        |
| `RouteTravel` between the two screens                 | nothing: a dialog has no neighbour                                                                                 |
| `onLoad` + `pristineKey`: the resource arrives after  | it is already in hand — the dialog is opened FROM the list                                                         |

What does not change:

- **Two states, not one.** "Do not let the two share one set of signals" applies
  word for word; the reset is a `key` on the form — naming WHICH record the
  dialog is opened on, not following a record that moved, which is a
  [`defaultValue`'s job](./control_value.md#a-defaultvalue-follows-what-it-was-read-from)
  — rather than emptying url signals.
- **Two modes driving a third component**: the fields are written once, and the
  caller hands them their state.
- **`include` for a pre-filled picker** — a radar's place is exactly the case
  [above](#a-field-that-picks-from-a-list-too-big-to-load).
- **The failure shows where it was asked for**, with what was typed still there
  — so the dialog must still be open, and the close waits for the action
  ([popup_open.md](./popup_open.md#closing-when-a-button-also-runs-an-action)).

## See also

- [form_changed.md](./form_changed.md) — what a form sends, what follows a send
- [navigation.md](./navigation.md) — routes, links, travelling
- [resource.md](./resource.md) — the store behind GET/POST/PUT
- [control_value.md](./control_value.md) — binding fields to signals
- [popup_open.md](./popup_open.md) — what opens a dialog, and what it opens on
