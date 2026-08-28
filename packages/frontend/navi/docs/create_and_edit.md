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
- [The edit screen opens before its values](#the-edit-screen-opens-before-its-values)
- [A field that picks from a list too big to load](#a-field-that-picks-from-a-list-too-big-to-load)
- [Where each screen goes next](#where-each-screen-goes-next)
- [After a write: what goes back to the network](#after-a-write-what-goes-back-to-the-network)
- [Movement between them](#movement-between-them)
- [The same loop in a dialog](#the-same-loop-in-a-dialog)

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
  and stale on the list two seconds later reads as data loss. Some of that is
  free (the store), some of it is a request the backend has to answer (a list
  after a creation) — see [after a write](#after-a-write-what-goes-back-to-the-network).
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
  subtree stays blank — and an effect in that component cannot rescue it, a
  suspended component has no effects. What to do instead is under "Reading an
  action" in [actions.md](./actions.md#reading-an-action).
- **Handle the error where it happens**, or hand it to an `<ErrorBoundary>`:
  `useAsyncData(action, { loading: true, error: true })` returns
  `[data, loading, error]`, which is what lets a page draw its own "the server
  refused" with a "try again" that calls `action.rerun()`. Which of the two, and
  what happens to an error no screen takes:
  [error_handling.md](./error_handling.md).

## Two screens, two states

The same three fields, and two different things behind them:

- the **create** screen holds a **draft** — nobody else's, not saved anywhere,
  worth keeping while it is being written. It belongs in the url
  (`searchParams`), which is what makes it survive a reload and travel in a
  link;
- the **edit** screen holds **what the server has**, loaded, and proposes
  changes to it. It is the screen's own state, alive as long as the screen is.

So the fields are written once, and know nothing about which screen they are in:

```jsx
const GameFormFields = ({
  nameSignal,
  levelSignal,
  playersSignal,
  loading,
}) => (
  <>
    <Input name="name" signal={nameSignal} loading={loading} required />
    <Select name="level" signal={levelSignal} loading={loading}>
      …
    </Select>
  </>
);
```

Each screen hands it its own:

```jsx
// créer: le brouillon, qui vit dans l'url
<GameFormFields
  nameSignal={draftNameSignal}
  levelSignal={draftLevelSignal}
  playersSignal={draftPlayersSignal}
/>;

// modifier: ceux de cet écran-ci, remplis quand la partie arrive
const nameSignal = useSignal(undefined);
```

**Do not let the two share one set of signals.** It is the mistake this shape
exists to prevent, and it does not look like one: bind both screens to the same
`nameSignal`, edit a game, then press "create" — the game you just edited is
sitting in the create form, and in the url. A draft and a resource are not the
same state; one is on the screen, the other is at the backend.

The draft's other half is the end of its life:

```jsx
action={async (values) => {
  const game = await GAME.POST.bindParams(values).rerun();
  GAME_ROUTE.navTo({ gameId: game.id });
  draftNameSignal.value = undefined; // il a servi
  draftLevelSignal.value = undefined;
}}
```

`undefined`, not `""`: a state signal put back to undefined returns to its
default and leaves the url — see [control_value.md](./control_value.md).

**Clear after navigating, not before.** Those signals are read by things on the
screen being left — the list of places is asked for with the place the draft
holds — so emptying them while that screen is still up asks for the list again,
for a screen nobody is looking at any more. Navigate first and the clearing is
what it should be: tidying up behind oneself.

> One signal for the whole form works too: `<Form signal={gameSignal}>` fills
> its named children from the object, follows it when something else writes it,
> and writes back the whole object as the fields change. Reach for it when the
> values arrive as one object and no field needs a url of its own — the fields
> then take nothing but their `name`.

## The edit screen opens before its values

The resource arrives a request after the screen. Two shapes, and both are
right — the question is what the person should be looking at meanwhile:

**The screen waits, showing the form.** The fields are there, empty and busy
(`loading` on a control marks it `aria-busy` and shows it), and they fill in
when the resource lands. Nothing blinks in and out, and a long screen does not
collapse to a spinner. What it costs is one thing to say — **when the filling is
done**:

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

`onLoad` is what the screen does with the data **once, when it becomes known**,
and the two hard parts are already answered by it:

- **How often.** Not every time the data arrives — a successful PUT, a list
  reloading, a poll all hand the same game back, and copying it again would
  overwrite what the person is in the middle of writing. It fires once per set
  of params, which is the action's own answer to "is this another thing, or the
  same one again". Written by hand this is a `useEffect` keyed on `game?.id`,
  and `[game]` is the natural, wrong, thing to write.
- **When.** From a layout effect, so what it writes belongs to the same tick as
  the render that got the data. That is what lets `pristineKey` be the id
  itself: the form takes its reference again at the end of that tick, and by
  then the fields are filled. A copy written in a passive effect (after the
  paint) would be too late — the screen would open **already changed**, and Save
  would send the resource back to the server untouched.

The rest of `pristineKey` is in [form_changed.md](./form_changed.md).

**Or the screen waits, showing nothing of the form**: render a skeleton until
the resource is there, then the form with its values already in the fields.
Nothing to announce then — the form holds them from its first render — but the
screen has to be one that can be blanked without the person losing their place.

Either way, cancelling is a link away: the screen is thrown away with what was
typed in it, and coming back re-reads the resource. There is nothing to restore.

## A field that picks from a list too big to load

A place, a player, a category: the field is a picker, and its popup holds a list
the backend answers with. The list is **one page** — the nearest, the most
recent, whatever a `LIMIT` returned. And the screen is pre-filled from the url:

```
/games/new?place=halle-des-sports
```

That is what pre-filling is: a link from a place's page, a back button, a
reload, a shared invitation. The signal is the selection, and the url is its
memory. But the url carries an **identifier and nothing else** — no name — so
the screen looks for it in the list it has:

```js
const selected = places.find((place) => place.id === placeId);
```

Nothing guarantees that `find`. The place may be far down the ranking, created
by someone else a minute ago, or named in a link built elsewhere. Nothing is
broken — the screen falls back on the identifier — but it then shows
`halle-des-sports` where it promised "Halle des sports", which is the opposite
of what pre-filling was for. Rare, never seen in development, and always at
someone else's.

Two ways out, and only one of them keeps the feature:

- **Clear the signals when the screen opens.** No selection, no selection to
  display. This throws away pre-filling, which is the reason those params exist:
  removing a feature is not fixing its edge case.
- **Ask for the list SAYING what you already hold.** What the screen holds
  travels with the request, and the backend guarantees that item is in the
  answer — on top of its page, whatever its rank.

```js
const PLACES_OF_SCREEN = routeAction(
  [NEW_GAME_ROUTE, EDIT_GAME_ROUTE],
  PLACE.GET_MANY,
  // pas `() => true`: ce que l'écran tient déjà doit voyager avec la demande
  () => {
    // en création: l'url, connue tout de suite
    if (NEW_GAME_ROUTE.matchingSignal.value) {
      return { include: draftPlaceSignal.value };
    }
    // en modification: elle arrive avec la ressource
    const game = GAME_OF_ROUTE.dataSignal.value;
    return game ? { include: game.placeId } : null;
  },
);
```

Reading the selection in the params is also what makes the list **reload when
the selection changes** — the action reruns on its own. Which is why the edit
screen returns `null` until the resource is there: asking for the list before
knowing what it must contain is asking for it twice, and the first answer is the
one that cannot show the name.

What `include` is, on the backend side, is the whole subject:

- **an addition, not a filter.** The page stays the page; the asked-for item is
  in it as well if it was not already, and once if it was;
- **it takes what a url can hold** — a slug as much as an id;
- **an `include` that designates nothing is not an error.** The answer is simply
  the page, and the screen falls back on its "not found" case — which then says
  something true (that place is gone) instead of being an artefact of
  pagination;
- it takes **several** values when several fields are pre-filled:
  `GET /users?include=42,57`.

> If a url signal designates an item of a paginated list, the identifier it
> carries must travel with the list request, and the backend must guarantee its
> presence in the answer. A paginated list is not "the first N", it is "the first
> N **plus what the caller already holds**".

The other half of the same problem is answered by the resource rather than by
the list: **what comes back with a resource carries its own label**. The game's
own page shows "Lieu: Halle des sports" with no list at all, because the GET
answers with the name next to the id. Only the url is reduced to an identifier,
and that is exactly where `include` earns its place.

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

## After a write: what goes back to the network

Creating one game, measured on the demo:

```
POST /games     la création
GET  /games     la liste se relit
GET  /games/2   la page de ce qui vient d'être créé
```

Each of the two GETs is a decision, and neither is an accident:

- **The list re-reads itself** because whether a new item belongs to a list
  depends on filters, pagination and sort — the backend knows, the client does
  not (`rerunOn.GET_MANY: ["POST"]`, and the whole table of defaults is in
  [list_refresh.md](./list_refresh.md)). A `PUT` does **not** re-read it: the
  store carries the new values into every list already holding that item, which
  is why the name changed on the game's page shows up on the list without a
  request.
- **The detail GET is not saved by the store.** The action for that id had never
  run, and the store holding the item is not the same thing as an action having
  its data. It is also often not redundant: a detail representation is richer
  than what a write answers — here the GET adds the place's name, the POST does
  not, and a screen trusting the POST would show "Lieu: —". Skipping it could
  only ever be a per-resource decision ("my POST answers the same shape as my
  GET").

Coming back to that page later in the same session costs **nothing**: an action
that has completed is not run again for the same params. That, and not any
cache, is what makes a screen already visited open instantly — and what a
`rerun()` is for when something must genuinely be read again.

## Movement between them

The screens are places, so the movement between them is `RouteTravel` — not
`SlideContainer`, which is for positions that are not routes (see
[navigation.md](./navigation.md#tabs-that-are-not-routes)).

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

## The same loop in a dialog

Everything above assumes each screen is a url, because that is what the loop
deserves when the thing being created is what the person came for. Half the
creations in an application are not that: a radar, a note, a member — a
**secondary resource**, edited without leaving the page one is reading. It has no
page of its own, and giving it one to change a name would take the person off the
page they were on. That loop happens in a dialog, and the reasoning above still
holds; only its mechanisms change.

| the page says                                         | the dialog says                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| two routes, `/new` and `/:id/edit`                    | one dialog, two modes — hence the value it is opened ON ([popup_open.md](./popup_open.md#opening-it-on-something)) |
| the draft lives in the `searchParams`                 | it lives in the dialog, and dies with it                                                                           |
| cancelling = leaving the screen, which is thrown away | `unmountWhenClosed` (+ a `key` on the form), same effect                                                           |
| `RouteTravel` between the two screens                 | nothing: a dialog has no neighbour                                                                                 |
| `onLoad` + `pristineKey`: the resource arrives after  | it is already in hand — the dialog is opened FROM the list                                                         |

What does not change, and is the reason this section is four lines rather than a
page of its own:

- **Two states, not one.** "Do not let the two share one set of signals" applies
  word for word. The reset is a `key` on the form rather than emptying url
  signals, but the mistake avoided is the same: opening "new" and finding what
  was just edited.
- **Two modes driving a third component.** The fields are written once and do not
  know which mode they are in; the caller hands them their state. That is the
  transposable half of the whole page.
- **`include` for a pre-filled picker.** A radar's place is exactly the case
  described [above](#a-field-that-picks-from-a-list-too-big-to-load), and a popup
  does not make it less true.
- **The failure shows where it was asked for**, with what was typed still there —
  which in a dialog also means the dialog must still be open, so the close waits
  for the action (see
  [popup_open.md](./popup_open.md#closing-when-a-button-also-runs-an-action)).

## See also

- [form_changed.md](./form_changed.md) — what a form sends, what follows a send
- [navigation.md](./navigation.md) — routes, links, travelling
- [resource.md](./resource.md) — the store behind GET/POST/PUT
- [control_value.md](./control_value.md) — binding fields to signals
- [popup_open.md](./popup_open.md) — what opens a dialog, and what it opens on
