# Navigation

How to build navigation with `@jsenv/navi`: declaring routes, rendering them,
linking to them, and turning them into tabs.

- [The rule that decides everything else: the position belongs in the URL](#the-rule-that-decides-everything-else-the-position-belongs-in-the-url)
- [Declaring routes](#declaring-routes)
  - [A document that is not at the root: `setBaseUrl`](#a-document-that-is-not-at-the-root-setbaseurl)
  - [A section is allowed to be a route of its own](#a-section-is-allowed-to-be-a-route-of-its-own)
  - [Which values a param accepts](#which-values-a-param-accepts)
  - [An address that only sends elsewhere](#an-address-that-only-sends-elsewhere)
  - [Search params](#search-params)
- [Rendering routes](#rendering-routes)
  - [Loading data](#loading-data)
- [Links and tab rows](#links-and-tab-rows)
- [The back arrow: `navBack`](#the-back-arrow-navback)
- [Tabs that travel: `RouteTravel`](#tabs-that-travel-routetravel)
- [Where a navigation lands: the scroll](#where-a-navigation-lands-the-scroll)
  - [Landing on an element: the fragment](#landing-on-an-element-the-fragment)
- [Creating something, then editing it](#creating-something-then-editing-it)
- [Tabs that are not routes](#tabs-that-are-not-routes)
  - [A `SlideContainer` in the URL: a position that is not a place one came from](#a-slidecontainer-in-the-url-a-position-that-is-not-a-place-one-came-from)
  - [A state whose values ARE places: `history: "push"`](#a-state-whose-values-are-places-history-push)
- [A layer over the screen: what its address may say](#a-layer-over-the-screen-what-its-address-may-say)
  - [`/me/settings` names a place the reader is not at](#mesettings-names-a-place-the-reader-is-not-at)
  - [What the search param buys: the way back is in the address](#what-the-search-param-buys-the-way-back-is-in-the-address)
  - [The wiring](#the-wiring)
  - [Places inside the layer](#places-inside-the-layer)
  - [What it costs](#what-it-costs)

## The rule that decides everything else: the position belongs in the URL

Where the user is — which section, which tab, which sub-page — is state. Put it
in the URL unless there is a reason not to. What that buys, none of which can be
retrofitted later: back and forward work, each place being a history entry; the
place is shareable and bookmarkable; it is **targetable** — anything in the app
can send the user there with a `<Link route={…}>`, knowing nothing of the
component that displays it; and a reload lands where the user was.

So the default shape of a tab row is routes: `<Nav>` + `<Link route>` +
`<RouteTravel>`. `SlideContainer` is the exception, not the starting point (see
[Tabs that are not routes](#tabs-that-are-not-routes)), with a middle answer: a
position READ from the URL and restored on reload, without a history entry per
step
([A `SlideContainer` in the URL](#a-slidecontainer-in-the-url-a-position-that-is-not-a-place-one-came-from)).

## Declaring routes

Every route is created with `route()` and all are declared to `setupRoutes()` in
one call: the routing system resolves specificity and signal ownership across the
whole set, so it has to see the whole set.

```js
// routes.js
import { route, setupRoutes } from "@jsenv/navi";

export const HOME_ROUTE = route("/");
export const GAMES_ROUTE = route("/games");
export const GAME_ROUTE = route("/games/:gameId");

setupRoutes([HOME_ROUTE, GAMES_ROUTE, GAME_ROUTE]);
```

Named exports from one module, on purpose: the file is the map of the
application, and an import line says which places a component deals with. Routes
are plain objects usable outside any component (`buildUrl()`, `navTo()`,
`redirectTo()`, `matching`), which is why they are declared apart from the JSX.

### A document that is not at the root: `setBaseUrl`

A second document in the same site — an admin panel at `/admin/admin.html`
beside the app at `/` — writes its routes as if its directory were the root,
after `setBaseUrl("/admin/admin.html")` in its routes module, above
`setupRoutes()` (see its JSDoc). **The server has to answer the document for
every address below it.** jsenv's dev server already does — an address it finds
no file for is answered with the closest html file above it, `<dirname>.html`
included, so `/admin/places/42` is served `/admin/admin.html` — and any other
host needs the same rule.

### A section is allowed to be a route of its own

When a segment can take a **finite, known set of values**, declare one literal
route per value rather than one parameterized route you pass params to:

```js
// ✅ each section is a route object of its own
export const MY_GAMES_ROUTE = route("/games/my_games");
export const CANDIDATE_GAMES_ROUTE = route("/games/candidates");
export const FINISHED_GAMES_ROUTE = route("/games/finished");
```

The routes are then listable — `routes.js` shows the places the application has,
where `/games/:section` shows one and hides three; call sites need no
`routeParams`, so a wrong section is a missing import rather than a string nobody
checks; and each section can carry search params of its own. Params stay for what
the code cannot enumerate (an id, a date), and for a finite set handled
**uniformly** — a row built by `.map()` over the sections — bound to a signal for
validation and a default.

A literal and a parameterized route can sit on the same segment, and both then
match: `/games/my_games` is also a `/games/:section`, whose signal is written
`"my_games"`. Where both exist,
the literal branch goes first (see [Rendering routes](#rendering-routes)) and the
param is constrained to the values it really takes (see
[Which values a param accepts](#which-values-a-param-accepts)).

#### Declaring the sections is what makes them places

Both forms written together say different things:

```js
export const MY_GAMES_ROUTE = route(`/games/me/:section=${sectionSignal}`);
export const MY_GAMES_TO_COME_ROUTE = route("/games/me"); // the default: no segment
export const MY_GAMES_CANDIDATE_ROUTE = route("/games/me/candidate");
export const MY_GAMES_DONE_ROUTE = route("/games/me/done");
```

On `/games/me/done`, `MY_GAMES_ROUTE.buildUrl()` gives `/games/me/done`: the
parameterized route reads its signal, so a link to "my games" from the bottom bar
**reopens the section you were looking at**. `MY_GAMES_TO_COME_ROUTE.buildUrl()`
gives `/games/me`, always: a tab must point at its own section, never at the one
already open — a tab pointing at the current page cannot be clicked. The default
section has no segment, so its literal route is the **parent** of the
parameterized one, and still does not inherit the param.

That the literals exist is what tells navi these values name pages. Where none is
declared, the value stays a qualifier, carried by an ancestor url:

```js
export const ADMIN_ROUTE = route(`/admin/:section=${sectionSignal}/`);
export const ADMIN_SETTINGS_ROUTE = route(`/admin/settings/:tab=${tabSignal}`);
// nobody declared /admin/settings/advanced, so on tab "advanced":
// ADMIN_ROUTE.buildUrl() → /admin/settings/advanced — "admin, where you left it"
```

### Which values a param accepts

A param says which segments it accepts, and a segment it declines is not a
half-match to be sorted out later — the route simply does not match:

```js
const SECTIONS = ["candidate", "to_come", "done"];
const sectionSignal = stateSignal("to_come", {
  id: "section",
  oneOf: SECTIONS,
});
export const GAMES_SECTION_ROUTE = route(`/games/:section=${sectionSignal}`, {
  params: { section: SECTIONS },
});
export const GAME_ROUTE = route(`/:gameId=${gameIdSignal}`, {
  params: { gameId: /^W-[A-Z0-9]{8}$/i },
});
```

This is what lets a param sit at the root without swallowing every single-segment
address: `/cgu` stays another route's url, `<Route fallback>` is reachable, and
no signal is written for a url this route has nothing to do with. A constrained
param is also **required**: `/:gameId` does not match `/`. The accepted forms are
in `route()`'s JSDoc.

#### Constrain the shape, never the existence

A constraint answers one question: **is this segment addressed to this route?**
It is decided on the url alone, before anything is written, so it can only be
about shape — that a segment looks like a game code, not that the game exists.
Whether the value is any good is asked later, by the signal's validation and the
route action's data, on a route that **did** match, with a page free to show a
not-found screen and offer a way out:

```js
// ✅ /W-ZZZZZZZZ matches, the action 404s, the page says so
// ❌ constraining gameId to the codes that exist — matching cannot ask a server,
//    and "no route matched" is a worse answer than "this game is gone"
```

Constraining is also the fix when several routes match one url and bind the
**same signal** on a param of the same name: they all write it, in declaration
order, the last one winning (`/:gameId/:state` matches `/games/W-ABC234PQ` and
writes `"games"` into a `gameIdSignal` it shares). Where a param genuinely cannot
be constrained, the routes must not share a signal.

### An address that only sends elsewhere

Some addresses are not pages — the root of an app whose home screen is « my
games », the old address of a section that moved, a share link carrying a
segment only WhatsApp cares about — and the route says so itself:

```js
export const HOME_ROUTE = route("/", { redirectRoute: MY_GAMES_ROUTE });
```

The redirection is resolved at the door of the navigation, before the url is
written anywhere: no history entry, no route action, nothing mounted, and going
back lands on the page before it. A page redirecting in an effect gets none of
that — the address exists, its action runs, and a screen nobody should see is
painted, one a route transition can even animate _to_ — so a redirection is
declared on the route, **never as a page rendering `null`**. It fires on the
route's own address only (`/` matches everything below it for rendering, and
would carry `/cgu` away); of several redirecting routes the more specific wins,
chains collapse into one navigation, and a cycle throws. Which params carry over:
the JSDoc of `redirectRoute` and `redirectRouteParams`.

#### A search param only the link carries: `dropSearchParams`

A share link can carry a param that is not for the app at all — `?v=k3f9x2`,
there because WhatsApp caches one link preview per address — and left in the bar
it gets copied and shared again, stale. The route that owns the address drops it
at the door, like a redirection, with `dropSearchParams: ["v"]`. A redirecting
route cannot do this: a search param never makes a pattern fail to match, so it
would match the address without `v` too, redirect it to itself, and report
`matching` next to the real route on every page.

#### When the destination depends on data

`/admin` sends the reader to the first section their permissions allow: a target
not known until `GET /me` has answered. That is not a redirection — the door
resolves an address from the url alone — it is a **landing that loads**: a route
action, and the redirection once the answer is there.

```js
export const ADMIN_ROUTE = route("/admin"); // no trailing slash: the landing alone

routeAction(
  ADMIN_ROUTE,
  async () => {
    const me = await ME.GET.run();
    firstSectionAllowed(me).redirectTo();
  },
  // params, even constant ones: an action without them is prerun on a hover
  () => true,
);
```

`redirectTo()` replaces the entry, so the back button still leaves by where the
reader came in. The params function is not optional: a route action declared
without one is prerun when the pointer reaches a link to it (see
[dynamic_import.md](./dynamic_import.md#ahead-of-the-render-intent)) — for a read
a head start, for a navigation the navigation happening on a hover. The cost: the
address exists, and something is on screen while the request is out — give it
the screen a wait deserves (the section frame, a `<Loading>`), not a page
rendering `null`.

### Search params

A param that qualifies a page rather than naming it — a zoom level, a sort, a
view mode — is a search param, declared with the signal it two-way syncs with:

```js
const vueSignal = stateSignal("liste", {
  id: "vue",
  oneOf: ["liste", "carte"],
});
export const HOME_ROUTE = route("/", { searchParams: { vue: vueSignal } });
```

The signal and the URL are the same state: never keep a `useState` beside a route
param for the same fact. Declared on the **root route**, a search param holds
wherever one is in the application; declared on one route, it exists only there.

Writing it AMENDS the history entry one is on rather than stacking a new one: a
param that qualifies a screen is not a place, and one entry per write turns a
single back-press into as many as the user moved. A state whose values ARE places
says so — see [`history: "push"`](#a-state-whose-values-are-places-history-push).

#### A value written per frame

Every write reaches the address, synchronously, and browsers refuse an address
written too often: Safari throws a `SecurityError` past 100 writes per 10
seconds, and the state then runs ahead of an address that stopped following
(Chromium and Firefox drop the writes silently; navi warns in dev).

**An address is not a recording of a gesture.** It records where the value was
PUT DOWN, not the path the finger took: a value one drags is held in the
component while the pointer is down and written on release — re-reading the
signal meanwhile would pull the control back mid-gesture — and a movement with no
release (a wheel zooming, a fly-to) is written once it has settled. When every
intermediate value IS a valid address — the centre of a panned map — the state
can ask navi to debounce the browser's copy of the address instead:

```js
const eastSignal = stateSignal(0, {
  id: "e",
  type: "number",
  debounceUrl: 200,
});
```

The routes, the document url and the renders still follow every write; only
`window.location` waits for the state to stay still that long, and a back pressed
before the write keeps the last address written. A push is never debounced.

## Rendering routes

`<Route>` is the only primitive. With `children` it is a container that renders
the branch matching the URL; with a `route` it is a branch; with `fallback` it is
the branch taken when no sibling matches.

A route matches its own address and nothing below it — `/games/:gameId` does not
match `/games/2/edit` — except `/` and a pattern ending in `/`, which match
everything below them too (`route("/games/")` matches `/games/2/edit`): that is
what keeps a section's container on screen while one is inside it. Two patterns
can still match one url — `/games/my_games` is also a `/games/:gameId` — and a
container renders the **first** branch that matches, in the order written, not
the most specific. So the branches go from the most precise to the widest, and
the pages of a `RouteTravel` row alike:

```jsx
<Route>
  <Route route={MY_GAMES_ROUTE} element={MyGamesPage} />
  <Route route={CANDIDATE_GAMES_ROUTE} element={CandidateGamesPage} />
  <Route route={GAME_ROUTE} element={GamePage} />
  <Route fallback element={NotFoundPage} />
</Route>
```

A section with a shared prefix owns its own sub-router: one leaf on
`/dashboard/` whose element renders its own `<Route>` tree and chrome, handing its
local state down through `elementProps`. Pages sharing a layout but no prefix
(`/profile`, `/settings`) use a container `<Route element={AuthLayout}>`, which
injects the active child as its children.

### Loading data

A page reads its data from a route action through `useAsyncData` and says only
what it renders; what it cannot render is delegated to an ancestor — waiting to
`<Loading>`, failing to `<ErrorBoundary>`. Both are written **between** the
container and its branches, and the container reads through them, so a whole
section of pages shares one:

```jsx
<Route>
  <ErrorBoundary
    fallback={({ error, resetError }) => (
      <ErrorScreen error={error} onRetry={resetError} />
    )}
  >
    <Loading fallback={<GameSkeleton />}>
      <Route route={GAME_ROUTE} element={GamePage} />
      <Route route={GAMES_ROUTE} element={GamesPage} />
    </Loading>
  </ErrorBoundary>
  <Route fallback element={NotFoundPage} />
</Route>
```

The order matters: the boundary goes **outside** the `<Loading>`. A page suspends
first and fails second, and a boundary placed under the `Suspense` it suspended
in is part of the tree being held.

A branch selected inside a wrapper keeps it — the container renders the active
branch alone, wrapper included — so `<Loading>`/`<ErrorBoundary>` can bracket a
subset of the branches rather than the whole router. What happens to a failure no
boundary takes: [error_handling.md](./error_handling.md).

## Links and tab rows

`<Link route={…}>` builds its href from the route, knows on its own whether it is
the current one — that is what draws the current-tab state — and fetches the code
of where it leads when the pointer or the focus reaches it (see
[dynamic_import.md](./dynamic_import.md#ahead-of-the-render-intent)). `<Nav>`
says once, for the whole row, where the bar that marks the current tab goes:

```jsx
<Nav currentIndicator>
  <Link route={MY_GAMES_ROUTE} variant="tab" replace>
    Mes parties
  </Link>
  <Link route={CANDIDATE_GAMES_ROUTE} variant="tab" replace>
    Candidatures
  </Link>
</Nav>
```

The bar glides from one tab to the next when the change between them plays as a
view transition — a `RouteTravel` swipe, a route transition — because `<Nav>`
names it for that movement (`currentIndicatorSlides`, on by default), and only
for a movement between two tabs of its own row: during any other route movement
the bar leaves or arrives with its row, a named element inside a page that moves
standing still (see
[view_transitions.md](./view_transitions.md#a-name-is-unique-per-document)).
With no transition at all, it jumps.

`replace` is what a row of tabs wants: the neighbour is a lateral move, not a step
deeper, so the destination takes the place of the current history entry — the
whole row weighs one entry, and the back button (the arrow at the top, the
phone's own) leaves by where the reader came in. The link stays a link (an
address, a middle click, `aria-current`); the same word is
`navTo(url, { replace: true })`, `route.redirectTo()`, `<Button replace>`. A
replaced entry inherits the state of the one it takes the place of: **an entry's
state does not say how it arrived** — only the navigation being applied does, and
navi is the one applying it.

An entry usually stands for a whole section: "Lieux" stays lit on `/places/42`
with `currentAlso={[PLACE_ROUTE]}`, and `currentExcept` names a place under the
section it does NOT stand for. Both amend what a link claims about itself and
nothing else — neither is an answer to a route that lies about where the reader
is (see [what its address may say](#a-layer-over-the-screen-what-its-address-may-say)).

## The back arrow: `navBack`

An arrow drawn inside the app promises the screen the reader came from — never
the page before the app, which is what `history.back()` gives on a screen opened
cold from a shared link, a bookmark, a notification. `window.history.length`
counts the whole tab and cannot tell the two cases apart, and neither can an
entry's state (above). navi counts the entries of THIS document underneath,
through every push and replace it applies — an app keeping its own count forgets
one, and it shows only on a cold-opened screen after a precise gesture.

```jsx
const canNavBack = useCanNavBack(); // reactive; canNavBackSignal outside components
```

```js
navBack({ fallback: USER_ME_ROUTE.buildUrl() });
```

The `fallback` takes the place of the current entry rather than stacking on it:
pushed, it would put the screen just left one press ahead, and the phone's own
back button would walk straight back into it — a loop with no way out of the app.
Without a `fallback`, a `navBack()` with nothing of ours behind does nothing. Said
by a button, it is a command carrying the fallback:

```jsx
<Button command={`--navi-nav-back:${USER_ME_ROUTE.buildUrl()}`}>←</Button>
```

## Tabs that travel: `RouteTravel`

`<RouteTravel>` wraps the `<Route>` tree of a row of tabs and makes every change
between them a movement — a tab pressed, a key, the back button, and a thumb
dragging the pages:

```jsx
<SectionNav />
<RouteTravel>
  <Route>
    <Route route={MY_GAMES_ROUTE} element={MyGamesPage} />
    <Route route={CANDIDATE_GAMES_ROUTE} element={CandidateGamesPage} />
    <Route route={FINISHED_GAMES_ROUTE} element={FinishedGamesPage} />
  </Route>
</RouteTravel>
```

The router still mounts only the branch that matches: the page being left is the
picture the browser keeps of it, and the page arriving mounts during the gesture,
filling in under the finger as its own loading state. The order of the tabs —
"one step that way", which no URL says — is the order the children are written;
the row is on the **first** of its pages that matches, like a `<Route>`; a page
left out of the row does not travel. A swipe **replaces** the current entry, as
`<Link replace>` does for a tab pressed: two gestures towards the same neighbour
must not write two different histories — and a row of tabs is the one place a
replace moves the scroll
([below](#a-row-of-tabs-where-a-replace-is-an-arrival)). Several `RouteTravel`
boxes may live on one page, and only the one travelling is captured.

`RouteTravel` is for pages that form a ROW the finger can push; pages related
pair by pair are animated with `defineRouteTransition`, and a given pair by one
of the two, never both (see
[route_transitions.md](./route_transitions.md#route-transitions-and-routetravel--one-pair-one-system)).
The gesture itself: [drag_to_travel.md](./drag_to_travel.md). Demos:
`src/nav/demos/route_travel/route_travel.html`, `src/nav/demos/tabs/tabs.html`.

## Where a navigation lands: the scroll

Five cases, and they are not a policy to configure but five different facts:

- **Going somewhere new** (a push to another path) lands at the top. It is an
  arrival: left alone, the new entry would be born holding the previous page's
  offset, which the browser would then hand back as this page's own. A push that
  keeps the path — a [layer](#a-layer-over-the-screen-what-its-address-may-say)
  opening, a [state whose values are places](#a-state-whose-values-are-places-history-push)
  — stacks an entry over the page the reader is scrolled in, and moves nothing.
- **Going somewhere new, to an element** (`/places/le-set#tournaments`) lands on
  the element once it is rendered (see
  [Landing on an element](#landing-on-an-element-the-fragment)).
- **Going back or forward** lands where that page was left, put back once the
  page is really rendered. The browser restores at the instant the entry changes,
  while the document still holds the page being left, and clamps away anything
  further down than that page is tall.
- **Replacing the entry** (`<Link replace>`, `route.redirectTo()`, a param
  settling) moves nothing: the same place said differently — except in a row of
  tabs, below.
- **A reload** lands where one was, as it would have without navi.

Where the browser exposes its stack (the Navigation API), **a `<Link>` whose
destination is the entry right next to the current one becomes a real
traversal**: a "back" link to the page one just came from behaves as a back — no
A, B, A, B… growth, and the scroll comes back — and one step forward too. Only
towards entries of this document, and never when the push carries explicit
state. An arrow that must ALWAYS behave as a back is `navBack()`.

### Landing on an element: the fragment

A link meant to bring one element under the reader's eyes — a notification
pointing at a section several screens down, a shared link to a comment, a row in
a list — is an `id` on the element and a `#id` in the link. Nothing else:

```jsx
<Box id="tournaments">…</Box>

// anywhere else — <Link route> builds no fragment, so the link spells its href
<Link href={`${PLACE_ROUTE.buildUrl({ slug })}#tournaments`}>…</Link>
```

The browser answers a fragment when the document finishes loading and on a
fragment navigation within the page — both before the data has drawn the element
— and a navigation navi routes is not a fragment navigation at all. So navi
answers every navigation it routes to a URL carrying a hash (a `#id` link to the
page one is already on stays the browser's own, without the wait or the ring):

- **it waits for the element, and for the page.** The element must exist and
  show something (`checkVisibility`): one inside a closed tab or a folded
  `<details>` has not arrived, and navi opens nothing to reach it. And no route
  or action may be loading: what sits above it may still push it down, and a
  node reused from the page being left is there before its own data;
- **it gives up** once the document has stopped working for a moment (or after a
  maximum wait, for one that never does): a link to an element that is gone lands
  where a link without a fragment would, with no mark;
- **a return is not an arrival**: back, forward and a reload land where the page
  was left, and only put `:target` on the element — no scroll, no ring, no focus;
- **it answers once per arrival**: a search param written while the reader is
  there does not throw them back to the element; pressing the very link one is on
  answers again.

What the reader gets: the element against the top edge, instantly; the keyboard
focus on it when it is itself focusable — an `id` on the link or the button, not
on a box around one; and a fading ring, the element carrying `data-url-target`.
The ring is coloured by `--navi-url-target-color` and lives in `@layer navi`: an
unlayered `[data-url-target] { … }` replaces it, `animation: none` removes it.
Its length is `markDuration`, set with `setUrlTargetOptions()` along with the
alignment and the waits; it also publishes `--navi-url-target-duration`, and
setting only the variable makes the ring and the attribute disagree.

**`:target` is the lasting "this one"**, `data-url-target` the moment it arrived.
navi sets `:target` as it lands on the element — the browser never would after a
navigation navi routes, nor for an element arriving after the load — and takes
it off once the URL stops naming it: a search param a route writes rebuilds the
address without its fragment, a back returns to the page without one. A node
rendered in its place later is another element. `useUrlTargetId()` is the id the
hash designates, reactive.

A fragment says where to look; a search param says what to show. When the page
draws something differently for the value — a filter, a selected row, an open
panel — it is a [search param](#search-params); when only the reader's eyes
should go somewhere, a fragment, down to a single row (`#tournament_42`) — never
a search param plus a `scrollIntoView` in an effect, which fires before what sits
above the element has laid out, with nothing to tell it how long to wait.

### A row of tabs, where a replace IS an arrival

The tabs of a `<RouteTravel>` navigate by replacing, and yet each one is another
route, sharing one scrollport — the document — that the tab on screen makes
tall: the moment the arriving tab is shorter, the browser clamps, and the
reader's place is gone. The row is the only thing that knows this, so on every
travel — a tab pressed, a thumb, a wheel, a travel put back — it gives the
arriving tab the offset it was read at, once it is really rendered; opens a tab
never read at its **top**, not wherever its neighbour happened to be; and never
records the clamp, which, recorded against the arriving tab's url, would destroy
that tab's own position.

**Only where the row owns the document**: nothing between the travelling box and
the viewport may scroll, and a row inside a scroller of its own leaves that
offset alone. An `overflow: hidden` on any ancestor is enough to take the row out
of the document's scrollport — it holds an offset even without a scrollbar, where
`overflow: clip` holds none — so it is the first thing to look for when a row
does not give positions back. And a page whose height depends on something still
loading is not tall enough when its position is put back: only the page knows
when it is whole. What navi itself builds after the first frame
(`<Box mount="after-paint">`, see
[scroll.md](./scroll.md#many-sections-box-mountafter-paint)) is not such a
page: the part the position shows is built before it is written.

## Creating something, then editing it

The create screen, the page of what was created, the edit screen — three routes,
one form, and a movement between them — are assembled in
[create_and_edit.md](./create_and_edit.md).

## Tabs that are not routes

`SlideContainer` holds slides that replace one another in one box, with the same
gestures and the same travelling bar, and — unless its signal is one the URL
holds, see below — nothing written to the URL. Use it when the position genuinely
is not a place one should be able to link to:

- the steps of a wizard, or the screens of a picker, inside a dialog or a popover
  — a popup is promoted to the browser's top layer, so no container can hold two
  of them side by side and `RouteTravel` has nothing to work with there;
- a carousel, or any window over something endless (days, months);
- a panel switch local to one widget, which nobody would ever send a link to.

If the answer to "should a link be able to open the app on this?" is yes, it is a
route.

```jsx
<Nav slideContainer="messagerie" currentIndicator>
  <Link slide="unread" variant="tab">Non lus</Link>
  <Link slide="read" variant="tab">Lus</Link>
</Nav>
<SlideContainer id="messagerie">
  <Slide area="unread">…</Slide>
  <Slide area="read">…</Slide>
</SlideContainer>
```

The row names its container by id, so it can sit anywhere on the page, and its
bar follows the slides, a finger dragging them included. `<Link slide>` has no
href and behaves like a button: this is not a link to anywhere.

### A `SlideContainer` in the URL: a position that is not a place one came from

"Should a link be able to open the app on this?" has a third answer, and a wizard
is exactly it: **yes for reading and for reloading, no for history.** The step
should be legible in the address bar and survive a reload, and should NOT stack
an entry per step: the back arrow of a form means "leave this form", not "one
question back", and four steps that each push walk the reader backwards through a
form they thought they had left. A search param already IS a position in the URL
that replaces rather than pushes; declare the step as one, and hand its signal to
the container:

```js
const stepSignal = stateSignal("when", {
  id: "step",
  oneOf: ["when", "where", "who", "recap", "done"],
  autoFix: true, // a value outside oneOf is repaired, and the address with it
  // the step qualifies THIS visit, not the screen: a link built to the editor
  // does not inherit it, and it goes back to the default when the route stops
  // matching
  weak: true,
});
export const ALERT_EDIT_ROUTE = route("/alerts/:alertId/edit", {
  searchParams: { step: stepSignal },
});
```

```jsx
<SlideContainer signal={stepSignal}>
```

Where it opens is the state's own default — a bound container does not own its
position, so one place says where the step starts, the same place a reset goes
back to — and the param is absent from the address while the step IS that
default. The container **walks** to the step the address asks for rather than
jumping to it: the address comes from outside the box (typed, shared, kept from a
session that has moved on), so every slide on the way is asked to let go the way
a key would ask it, and the first one that holds is where one stops —
`?step=done` cannot open a confirmation for something nobody sent. The signal is
then written with the area actually shown, and only the travels that HAPPENED are
written (one a lock or `onCurrentChange` refused never reaches it, or is written
back). A value no slide carries is left as asked: refusing it is the state's job,
`oneOf` + `autoFix`. A container remembers nothing across a reload, so a step the
app knows is already satisfied says so itself (`required={!alreadyFilled}`,
`preventNavNext={!published}`).

**A start that depends on the page one is on** — a wizard creating something
opens on its first question, the same wizard editing something opens on its
summary — is said by the ROUTE, not by the state and not by the container:

```js
const stepSignal = stateSignal("when", { id: "step", weak: true });
route("/alerts/create", { searchParams: { step: stepSignal } });
route("/alerts/:alertId/edit", {
  searchParams: { step: { signal: stepSignal, default: "recap" } },
});
```

Everything that asks "is this the default" then asks the route one is on: both
addresses stay clean on the step they open on, and going from one to the other
moves the step with it. Two containers on one screen are two signals — the one
holding the route's signal owns the param; a gallery of wizards side by side
hands each a `useSignal` of its own, and nothing goes into the address.

### A state whose values ARE places: `history: "push"`

Replacement is the default because most URL-held state qualifies the screen one
is on. A state whose values are places one came from — the photo being looked at
in a gallery — says so where it is declared, and one write can still say
otherwise:

```js
const photoSignal = stateSignal(undefined, { id: "photo", history: "push" });
photoSignal.set(nextPhoto, { history: "replace" });
```

A slide reached by DRAGGING is such a write — swiping back and forth with a thumb
is browsing, not a trail one wants to walk home along — and `SlideContainer`
replaces for its own drags even when its state pushes.

### What this is not

It is not a route. A search param bound to a `SlideContainer` moves the box, not
a page: nothing is declared for the steps, nothing matches on them, and no route
transition is written for them. A position several parts of the app must react
to is still a route. Demo: `src/layout/demos/8_slide_container_demo.html`.

## A layer over the screen: what its address may say

Some things are opened from everywhere and drawn OVER whatever the reader was
looking at: the settings behind a gear in the top bar, a photo, a help sheet.
Closing one puts the reader back exactly where they were — on the page they had,
not one the app picked — and the address has to hold it, for the same reasons
every other position does: a reload lands on it, a link opens on it, the back
button closes it. Routing decides a great deal of what is on screen — which page
is mounted, whose data loads, which bar entry lights up, which movement plays —
so a layer, a pure fact of layout, cannot be given just any address:

> The URL may say what is drawn OVER the screen. It must never name a place the
> reader is not at.

### `/me/settings` names a place the reader is not at

Settings opened from anywhere and drawn over anything are not inside `/me`, even
when they conceptually belong to "me". Written `/me/settings`, the router
believes otherwise, and everything that reads the router inherits the belief:

- the bar entry for the "me" section lights up while the settings cover a game;
- the screen the reader was on is REPLACED by a page of the "me" section: the
  covering is a fiction that lasts as long as the animation;
- a route transition plays a crossing between two pages that never crossed, and
  its back half plays on every way out — the sheet lifts to reveal a page that
  was never underneath;
- closing does not return to `/me`, it returns to wherever the reader was, which
  the address never said.

These do not get fixed one at a time: `currentExcept`, a `"none"` relation, a
hand-rolled `active` each patch one reader of the lie, and the next reader
arrives quietly wrong.

### What the search param buys: the way back is in the address

`/settings` at the top level is honest about not being inside `/me`, but it is
still a PAGE: the screen beneath is gone, and closing has nowhere written to
return to — so the rule is about not claiming a position, not about search
params. `/places?settings` says both which screen the reader is on and what is
drawn over it, so closing needs no memory at all: exact after a reload, from a
link someone sent, in a new tab. `/settings` has to remember instead — the
browser's history of the tab often covers for it after a reload, but a link
someone else opens has none of it, and neither does a bookmark. Only the address
travels.

### The wiring

```js
const settingsSignal = stateSignal(false, {
  id: "settings",
  type: "boolean",
  weak: true,
  history: "push",
});
export const ROOT_ROUTE = route("/", {
  searchParams: { settings: settingsSignal },
});
```

```jsx
<Button command="--navi-toggle" commandFor="settings_panel">⚙</Button>
…
<SidePanel
  id="settings_panel"
  signal={settingsSignal}
  side="top"
  expandY
  animation
/>
```

Every piece of it answers something:

- **declared on the ROOT route**, so the layer opens over every screen, where its
  door in the furniture is;
- **`weak`**: a link built to a page never inherits a layer that happens to be
  open — a layer qualifies one visit, it is not part of anyone's address;
- **`history: "push"`**: the layer is a place one came from, and the back button
  closes it. The closing is never an entry of its own —
  [popup_open.md](./popup_open.md#signal--the-app-holds-it-both-ways) owns what a
  `signal` bound to a URL writes on open, on close, and on cancel;
- **the panel is rendered outside the page area**, next to the router: over the
  pages and the fixed bars alike, mounted while closed, `animation` giving it an
  entrance of its own (a `SidePanel` has none by default);
- **`expandY`**, because a sheet is content-tall by default and a layer covers
  the screen. A tab row inside it must NOT get `expand`: that is both axes, and
  in the panel's column the row eats the height and pushes everything below it
  off screen;
- **no `defineRouteTransition` for it.** The page beneath does not change, so
  there is no pair of pages to move between — route transitions are for pages
  replacing pages ([route_transitions.md](./route_transitions.md)).

### Places inside the layer

A layer big enough to have tabs holds them the way a wizard does — a search param
of its own, `oneOf` its pages, replacing rather than pushing, so the back button
closes the layer instead of stepping back one tab. Everything in
[A `SlideContainer` in the URL](#a-slidecontainer-in-the-url-a-position-that-is-not-a-place-one-came-from)
applies unchanged, and a layer is exactly the case
[Tabs that are not routes](#tabs-that-are-not-routes) names for `SlideContainer`
over `RouteTravel`.

```js
const settingsTabSignal = stateSignal("account", {
  id: "settings_tab",
  oneOf: ["account", "alerts", "advanced"],
  weak: true,
});
```

The address then grows and shrinks with what the reader does: `/me` closed,
`/me?settings` open on the tab it opens on, `/me?settings&settings_tab=alerts`
one tab further, and back to `/me?settings` returning to the first. Two params,
because they answer two questions — is the layer there, and which of its pages
is shown. A popup's `value` answers another one, WHICH of several popups is open
(one sheet per card under a single `?seat=<gameId>`), not what varies inside one
(see [popup_open.md](./popup_open.md#signal--the-app-holds-it-both-ways)).

### What it costs

This is a compromise, and it is worth stating rather than discovering:

- **the page beneath stays mounted and alive under an opaque layer.** Its actions
  keep running, refreshing, retrying, for something nobody can see. Nothing tells
  a route "you are covered", and nothing should be inferred from a layer being
  open — the reader is still on that page, and will be back on it in a moment;
- **the router knows nothing about layers.** `<Route>` renders pages; the layer is
  drawn beside them by the application, and "over" is not a routing concept;
- **the app really is on the page underneath**, which is right for
  `aria-current`, for the bar, for a link built while the layer is open — and
  wrong for anything wanting "the settings are what is current": that reads the
  layer's own state, not the router.

Demo: `src/nav/demos/route_transition_fixed_bars/route_transition_fixed_bars.html`
— a bar holding both doors side by side: notifications, a page that replaces the
screen with a route transition, and settings, a layer that covers it.
