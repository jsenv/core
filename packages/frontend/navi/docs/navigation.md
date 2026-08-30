# Navigation

How to build navigation with `@jsenv/navi`: declaring routes, rendering them,
linking to them, and turning them into tabs.

## The rule that decides everything else: the position belongs in the URL

Where the user is — which section, which tab, which sub-page — is state. Put it
in the URL unless there is a reason not to. What that buys, none of which can be
retrofitted later:

- the browser's back and forward buttons work, because each place is a history
  entry;
- the place is shareable and bookmarkable — someone can send a link to exactly
  what they are looking at;
- the place is **targetable**: anything, anywhere in the app, can send the user
  there with a `<Link route={…}>`, without knowing anything about the component
  that displays it;
- a reload lands where the user was.

So the default shape of a tab row is routes: `<Nav>` + `<Link route>` +
`<RouteTravel>`. `SlideContainer` is the exception, not the starting point — see
[Tabs that are not routes](#tabs-that-are-not-routes) for the cases that
genuinely are one, and for the middle answer: a position READ from the URL and
restored on reload, without a route and without a history entry per step.

## Declaring routes

Every route is created with `route()` and they are all declared to `setupRoutes()`
in one call — the routing system resolves specificity and signal ownership across
the whole set, so it has to see the whole set.

```js
// routes.js
import { route, setupRoutes } from "@jsenv/navi";

export const HOME_ROUTE = route("/");
export const GAMES_ROUTE = route("/games");
export const GAME_ROUTE = route("/games/:gameId");

setupRoutes([HOME_ROUTE, GAMES_ROUTE, GAME_ROUTE]);
```

Named exports from one module, on purpose: the file is the map of the
application, and an import line says which places a component deals with.
Routes are plain objects usable outside of any component — `route.buildUrl()`,
`route.navTo()`, `route.redirectTo()`, `route.matching` — which is why they are
declared apart from the JSX that renders them.

### A section is allowed to be a route of its own

This is the most commonly missed point.

When a segment can take a **finite, known set of values**, declare one literal
route per value rather than one parameterized route you pass params to:

```js
// ✅ each section is a route object of its own
export const MY_GAMES_ROUTE = route("/games/my_games");
export const CANDIDATE_GAMES_ROUTE = route("/games/candidates");
export const FINISHED_GAMES_ROUTE = route("/games/finished");
```

A literal route may sit alongside a parameterized one on the same segment
(`/games/:section` and `/games/my_games`). Both match, and the literal one is
taken as the more specific — so declaring the sections costs nothing and takes
nothing away.

Why prefer it:

- **The routes are listable.** `routes.js` shows the places the application has.
  A single `/games/:section` shows one place and hides three.
- **No `routeParams` at the call sites.** `<Link route={MY_GAMES_ROUTE}>` instead
  of `<Link route={GAMES_ROUTE} routeParams={{ section: "my_games" }}>`, and the
  same for `<Route>`. A wrong section is then a missing import rather than a
  string nobody checks.
- **Each section can carry its own search params.** `/games/finished` may have a
  `sort` the other sections have no business knowing about.

Params stay for what is genuinely dynamic — a value the code cannot enumerate:

```js
export const GAME_ROUTE = route("/games/:gameId"); // ✅ an id
export const DAY_ROUTE = route("/planning/:day"); // ✅ any date
```

A parameterized route also remains right for a finite set that must be handled
**uniformly** — a row built by `.map()` over a list of sections, where writing
one branch per section would be writing the same branch N times. Bind the param
to a signal to get validation and a default:

```js
import { stateSignal } from "@jsenv/navi";

const sectionSignal = stateSignal("to_come", {
  id: "games_section",
  oneOf: ["candidate", "to_come", "done"],
  autoFix: true,
});
export const GAMES_SECTION_ROUTE = route(`/games/:section=${sectionSignal}`);
```

#### Declaring the sections is what makes them places

Both forms can be written together, and they say different things — which is
why declaring the literals is not decoration:

```js
export const MY_GAMES_ROUTE = route(`/games/me/:section=${sectionSignal}`);
export const MY_GAMES_TO_COME_ROUTE = route("/games/me"); // the default: no segment
export const MY_GAMES_CANDIDATE_ROUTE = route("/games/me/candidate");
export const MY_GAMES_DONE_ROUTE = route("/games/me/done");
```

Standing on `/games/me/done`:

- `MY_GAMES_ROUTE.buildUrl()` → `/games/me/done`. The parameterized route reads
  its signal, so a link to "my games" from the bottom bar **reopens the section
  you were looking at**. That is what the signal is for, and `persists` makes it
  survive the night;
- `MY_GAMES_TO_COME_ROUTE.buildUrl()` → `/games/me`, always. A tab must point at
  its own section, never at the one already open — a tab pointing at the current
  page is a tab that cannot be clicked.

The default section is the delicate one: it has no segment of its own, so its
literal route is the **parent** of the parameterized one. It still means the
default section and does not inherit the param.

What tells navi these values name pages rather than qualify one is precisely
that the literal routes exist. Where no literal is declared, the value stays a
qualifier and an ancestor url keeps it:

```js
const tabSignal = stateSignal("general", { id: "settings_tab" });
export const ADMIN_ROUTE = route(`/admin/:section=${sectionSignal}/`);
export const ADMIN_SETTINGS_ROUTE = route(`/admin/settings/:tab=${tabSignal}`);
// nobody declared /admin/settings/advanced, so on tab "advanced":
// ADMIN_ROUTE.buildUrl() → /admin/settings/advanced — "admin, where you left it"
```

So the rule is the one you would want: name a section and it becomes a place;
leave it unnamed and it stays a setting carried along.

### Which values a param accepts

A param says which segments it accepts, and a segment it declines is not a
half-match to be sorted out later — the route simply does not match:

```js
export const GAME_ROUTE = route(`/:gameId=${gameIdSignal}`, {
  params: { gameId: /^W-[A-Z0-9]{8}$/i },
});
```

A constraint is a regexp, the list of accepted values, or a `(value) => boolean`
— the list is compared as strings, so it can be the very `oneOf` given to the
signal bound to that param:

```js
const SECTIONS = ["candidate", "to_come", "done"];
const sectionSignal = stateSignal("to_come", {
  id: "section",
  oneOf: SECTIONS,
});
export const GAMES_SECTION_ROUTE = route(`/games/:section=${sectionSignal}`, {
  params: { section: SECTIONS },
});
```

This is what makes a param usable at the root, where it would otherwise swallow
every single-segment address: `/cgu` and `/me` stay other routes' urls,
`<Route fallback>` is reachable for `/whatever`, and no signal is written for a
url this route has nothing to do with.

A constrained param is also **required** — no segment is not one of the values
it accepts — so `/:gameId` does not match `/`. The address with no segment is a
route of its own, which is the shape you want anyway.

#### Constrain the shape, never the existence

A constraint answers one question: **is this segment addressed to this route?**
It is decided on the url alone, before anything is written, so it can only be
about shape — that a segment looks like a game code, not that the game exists.

Whether the value is any good is a different question, asked later and answered
by different things: the signal's own validation (`oneOf`, `autoFix`) and the
route action's data. That question belongs to a route that **did** match, with a
page free to repair itself, show a not-found screen, offer a way out:

```js
// ✅ /W-ZZZZZZZZ matches, the action 404s, the page says so
// ❌ constraining gameId to the codes that exist — matching cannot ask a server,
//    and "no route matched" is a worse answer than "this game is gone"
```

So the signal never takes part in matching. It knows what to make of a value;
the route decides whether the url is its own.

#### Why order stops being load-bearing

When several routes match one url and bind the **same signal** on a param of the
same name, they all write it, in declaration order — the last one wins:

```js
route(`/games/:gameId=${gameIdSignal}`); // declared first
route(`/:gameId=${gameIdSignal}/:state`); // declared later
// on /games/W-ABC234PQ the second one matches too and writes "games"
```

Constraining `gameId` removes that second match entirely, which is the fix.
Where a param genuinely cannot be constrained, the routes must not share a
signal.

### An address that only sends elsewhere

Some addresses are not pages: the root of an app whose home screen is « my
games », the old address of a section that moved, the share link of a game
carrying a segment only WhatsApp cares about. They exist to be resolved, and a
route says so itself:

```js
export const HOME_ROUTE = route("/", { redirectRoute: MY_GAMES_ROUTE });
export const GAME_SHARED_ROUTE = route("/:gameId/:shareState", {
  redirectRoute: GAME_ROUTE,
});
```

The params found in the url carry over to the ones the target route declares
under the same name — `gameId` above needs no help — and what it cannot place
is left behind, `shareState` included. `redirectRouteParams` says the rest:

```js
// renaming, when the two routes do not call it the same thing
route("/partie/:id", {
  redirectRoute: GAME_ROUTE,
  redirectRouteParams: ({ id }) => ({ gameId: id }),
});
// dropping one, keeping the others
route("/:gameId/invite", {
  redirectRoute: MY_GAMES_ROUTE,
  redirectRouteParams: { gameId: undefined },
});
// carrying nothing over
route("/tri", { redirectRoute: MY_GAMES_ROUTE, redirectRouteParams: null });
```

#### Why it is not a page rendering `null`

The redirection is resolved at the door of the navigation, before the url is
written anywhere. Nothing about that address ever happens: no history entry, no
route matching, no route action loading data for a screen nobody will see, no
element mounted, nothing painted — and going back lands on the page before it
rather than replaying the redirection forever.

A page doing it in an effect gets none of that. It has to be routed to first,
which means the address exists, its action runs, and the app is on a screen
nobody should see for one paint — one a route transition can even animate _to_.
Anything reached by rendering is already too late, so a redirection is declared
with the address and never appears in the `<Route>` tree at all.

It fires on the route's own address only. `/` catches everything below it when
it renders a container, and would carry `/cgu` away with it if redirecting
followed the same reading — so redirecting asks the stricter question: is this
url exactly that route's address?

Where several redirecting routes answer for one url, the more specific wins —
`/:gameId/invite` over `/:gameId/:shareState`, the same reading the rest of the
router uses. Chains collapse into one navigation, and a cycle throws naming the
addresses it goes through.

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

The signal and the URL are the same state: writing the signal rewrites the URL,
and a URL arriving from outside writes the signal. Never keep a `useState`
beside a route param for the same fact.

Declared on the **root route**, a search param is a position that holds wherever
one is in the application — a view mode that survives moving from page to page.
Declared on one route, it exists only there.

Writing it AMENDS the history entry one is on rather than stacking a new one: a
param that qualifies a screen is not a place, and one entry per write turns a
single back-press into as many as the user moved. A state whose values ARE
places says so — see [`history: "push"`](#a-state-whose-values-are-places-history-push).

## Rendering routes

`<Route>` is the only primitive. With `children` it is a container that renders
the branch matching the URL; with a `route` it is a branch; with `fallback` it is
the branch taken when no sibling matches.

```jsx
<Route>
  <Route route={MY_GAMES_ROUTE} element={MyGamesPage} />
  <Route route={CANDIDATE_GAMES_ROUTE} element={CandidateGamesPage} />
  <Route route={GAME_ROUTE} element={GamePage} />
  <Route fallback element={NotFoundPage} />
</Route>
```

`elementProps` passes props to the element, which is how a section hands its own
local state down to its sub-pages.

Two shapes for a section, and which one applies is decided by the URL:

- **A section with a shared prefix owns its own sub-router.** One leaf
  `<Route route={DASHBOARD_SECTION_ROUTE} element={DashboardSection} />` at the
  top, and `DashboardSection` renders its own `<Route>` tree plus whatever chrome
  it has. Everything about the section is in one file.
- **Pages sharing a layout but no prefix** (`/profile` and `/settings` inside an
  authenticated shell) use a container `<Route element={AuthLayout}>`: the active
  child is injected into the layout as its children.

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

The order matters: the boundary goes **outside** the `<Loading>`. A page
suspends first and fails second, and a boundary placed under the `Suspense` it
suspended in is part of the tree being held.

A branch selected inside a wrapper keeps it — the container renders the active
branch alone, wrapper included, so `<Loading>`/`<ErrorBoundary>` can bracket a
subset of the branches rather than the whole router. What happens to a failure
no boundary takes: [error_handling.md](./error_handling.md).

## Links and tab rows

`<Link route={…}>` builds its href from the route and knows on its own whether it
is the current one — that is what draws the current-tab state. `<Nav>` says once,
for the whole row, where the bar that marks the current tab goes:

```jsx
<Nav currentIndicator>
  <Link route={MY_GAMES_ROUTE} variant="tab">
    Mes parties
  </Link>
  <Link route={CANDIDATE_GAMES_ROUTE} variant="tab">
    Candidatures
  </Link>
</Nav>
```

The bar travels from one tab to the next rather than blinking, because `<Nav>`
gives it a `view-transition-name` of its own: the browser then moves it on the
same clock as any transition playing — including a `RouteTravel` swipe, with no
wiring between the two.

A row of tabs is a lateral move: the neighbour is one finger away, and going
there is not going one step deeper. `replace` says exactly that — the
destination takes the place of the current history entry instead of stacking
onto it, so the whole row weighs one entry and the back button (the arrow at the
top, the phone's own) leaves by where the reader came in:

```jsx
<Link route={CANDIDATE_GAMES_ROUTE} variant="tab" replace>
  Candidatures
</Link>
```

The link stays a link — an address, a middle click, the keyboard, `aria-current`
— only the way there changes. It is the same word as `navTo(url, { replace:
true })` and `route.redirectTo()` — and as `<Button replace>`, on an `href` or
on a `--navi-nav-to` command.

A replaced entry inherits the state of the one it takes the place of (so does
`route.redirectTo()`): **an entry's state does not say how it arrived**. Only
the navigation being applied says that, and navi is the one applying it — see
the back arrow below, which is what that fact is usually needed for.

## The back arrow: `navBack`

An arrow drawn inside the app promises the screen the reader came from — never
the page they were on before the app. Both cases are real for the same url: one
descends into a profile from a list, or one opens it cold from a shared link, a
bookmark, a notification. `history.back()` answers the first and, on the second,
gives back the conversation the link came from.

`window.history.length` cannot tell them apart — it counts the whole tab — and
neither can an entry's state, for the reason just above. What answers is a count
of how many entries of THIS document stand underneath, kept as the navigations
are applied and written into each entry so it survives a reload mid-stack. navi
keeps it: an app that kept its own would have to be told about every single
`replace` it performs, and the one it forgets shows up only on a cold-opened
screen after a precise gesture.

```jsx
const BackButton = () => {
  const canNavBack = useCanNavBack();
  ...
};
```

`useCanNavBack()` (or `canNavBackSignal` outside a component) is reactive: the
arrow appears and disappears as the stack moves, it is not decided at mount.

```js
navBack({ fallback: USER_ME_ROUTE.buildUrl() });
```

The `fallback` takes the place of the current entry rather than stacking on it:
pushed, it would put the screen just left one press ahead, and the phone's own
back button would walk straight back into it — a loop with no way out of the
app. Without a `fallback`, a `navBack()` with nothing of ours behind does
nothing.

Said by a button, it is a command, the fallback being its argument the way
`--navi-nav-to` carries its destination:

```jsx
<Button command={`--navi-nav-back:${USER_ME_ROUTE.buildUrl()}`}>←</Button>
```

## Tabs that travel: `RouteTravel`

`<RouteTravel>` wraps the `<Route>` tree of a row of tabs and makes every change
between them a movement — a tab pressed, a key, the back button, and a thumb
dragging the pages.

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

The router still mounts only the branch that matches; the page being left is
shown from the picture the browser keeps of it. The page arriving mounts during
the gesture and fills in under the finger, as its own loading state.

The order of the tabs — what "one step that way" means, which no URL says — is
read from the children in the order they are written. Pass `routes` only to say
another order, or when the pages are not children of the box. An entry is a route,
or `{ route, params }` when the tabs are params of one route.

The row is on the **first** of its pages that matches, the way a `<Route>` shows
its first matching branch — several routes match at once when one is a case of
another. A page left out of the row does not travel: reaching it is a change of
place, not a step along the row, and it plays no movement. `axis="y"` lays the
pages out as a column instead: forward is then the page rising and the next one
coming up from below.

A swipe **replaces** the current history entry, and a tab pressed says the same
thing when its link asks for it (`<Link replace>`, see above) — the two gestures
towards the same neighbour must not write two different histories. `onTravel`
decides otherwise. A replace normally leaves the scroll where it is; a row of
tabs is the exception, and gives each tab back the offset it was read at — see
[A row of tabs, where a replace IS an arrival](#a-row-of-tabs-where-a-replace-is-an-arrival).

Several `RouteTravel` boxes may live on one page — a section of the path and a
search param of the root route are two rows of tabs, both live — and only the one
actually travelling is captured.

Demo: [../src/nav/demos/route_travel/route_travel.html](../src/nav/demos/route_travel/route_travel.html)
and [../src/nav/demos/tabs/tabs.html](../src/nav/demos/tabs/tabs.html). The full
spec of the gesture is [drag_to_travel.md](./drag_to_travel.md).

`RouteTravel` is for pages that form a ROW the finger can push. Pages related
pair by pair without being a row — a game opened from several places, a
settings page rising over whatever showed it — are animated with
`defineRouteTransition` instead, and a given pair must be animated by one of
the two, never both: see [route_transitions.md](./route_transitions.md).

## Where a navigation lands: the scroll

Four cases, and they are not a policy to configure but four different facts:

- **Going somewhere new** (a `<Link>`, anything that pushes) lands at the top.
  It is an arrival: the offset one had elsewhere means nothing here, and left
  alone the new entry would be born holding the previous page's offset — which
  the browser would then hand back as if it were this page's own.
- **Going back or forward** (the browser's buttons, `navBack()`,
  `history.back()`) lands where that page was left. navi keeps the position and
  puts it back once the page is really rendered, which is what the browser
  cannot do: it restores at the instant the entry changes, when the document
  still holds the page being left, so anything further down than that page is
  tall is clamped away.
- **Replacing the entry** (`<Link replace>`, `route.redirectTo()`, a param
  settling, a state written) moves nothing. It is the same place said
  differently, and the reader is still in the page they were reading — a row of
  tabs is the one shape where that reading is wrong, see below.
- **A reload** lands where one was, as it would have without navi.

One consequence is softened where the browser exposes its stack (the
Navigation API — everywhere but Firefox today): **a `<Link>` whose destination
is the entry right next to the current one becomes a real traversal** instead
of a push. A "back" link to the page one just came from therefore behaves as a
back — the stack stays what the reader thinks it is (no A, B, A, B… growth)
and the scroll comes back; one step forward too, so returning to the page one
just left resumes it where it was. Only towards entries of this document (a
traversal to another one would be a full page load no link asked for), and
never when the push carries explicit state.

Everywhere else a `<Link>` is an arrival and lands at the top. A back arrow
that must ALWAYS behave as a back — even far from the entry it targets, even
in a browser with no Navigation API — is `navBack()`. Where there may be
nothing to go back to (a shared link opened cold), decide what the arrow does
from the history, not from the link.

### A row of tabs, where a replace IS an arrival

The tabs of a `<RouteTravel>` navigate by replacing, and yet each one is another
route. They also share a single scrollport — the document — and the tab on
screen is what makes it tall. So leaving the offset alone does not keep it: the
moment the arriving tab is shorter, the browser clamps, and the reader's place
is gone before anything of navi's is asked.

The row is the only thing that knows this, so the row is what says it. On every
travel — a tab pressed, a thumb dragging the pages, a wheel, a travel let go of
too early and put back:

- the arriving tab is given back the offset it was read at, once it is really
  rendered;
- a tab never read opens at its **top**, rather than wherever its neighbour
  happened to be;
- the clamp itself is never recorded. It is not the reader scrolling, and the
  url it would be written against is already the arriving tab's — recorded, it
  destroys that tab's own position, which is then what a later back or forward
  hands out.

**Only where the row owns the document**: nothing between the travelling box and
the viewport may scroll or clip. A row inside a scroller of its own — a frame in
an article, a panel beside other content — shares nothing with the document, and
the offset there belongs to the page around it, which the reader never left; the
travel leaves it alone. An `overflow: hidden` or `clip` on any ancestor is
enough to put the row outside the document's scrollport, so a row that should
give positions back and does not is worth looking at from that angle first.

Pages that scroll inside themselves rather than scrolling the document are not
concerned either way: each one brings its own scrollport, which goes away with
the page and has nothing to give back.

What is not covered: a page whose height depends on something still loading is
not tall enough at the moment its position is put back, so a deep position is
clamped as it was before. Only the page knows when it is whole.

## Creating something, then editing it

The create screen, the page of what was created, the edit screen — three routes,
one form, and a movement between them. It is assembled in
[create_and_edit.md](./create_and_edit.md), which is also where the two matching
rules that decide the shape of the `<Route>` tree are spelled out (several routes
match at once; the first matching branch wins).

## Tabs that are not routes

`SlideContainer` holds slides that replace one another in one box, with the same
gestures and the same travelling bar, and — unless the signal it is bound to is
one the URL holds, see below — nothing written to the URL. Use it when the
position genuinely is not a place one should be able to link to:

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

`<Nav slideContainer>` names the container by id — the row can sit anywhere on the
page. It reads which slide is on screen from the container itself, and its bar
follows the slides, a finger dragging them included. `<Link slide>` has no href
and behaves like a button: this is not a link to anywhere.

### The middle answer: a position in the URL that is not a place one came from

"Should a link be able to open the app on this?" has a third answer, and a wizard
is exactly it: **yes for reading and for reloading, no for history.** The step one
is on should be legible in the address bar and should survive a reload —
`/alerts/W-123/edit` reopening on "Lieu" because that is where the reader was —
and it should NOT stack an entry per step, because the back arrow of a form means
"leave this form", not "one question back". Four steps that each push turn one
back-press into four, and walk the reader backwards through a form they thought
they had left.

There is nothing to invent for it: a search param already IS a position in the
URL that replaces rather than pushes ([Search params](#search-params)). Declare
the step as one, and hand its signal to the container:

```js
const stepSignal = stateSignal(undefined, {
  id: "step",
  oneOf: ["when", "where", "who", "recap", "done"],
  // the step qualifies THIS visit, not the screen: a link built to the editor
  // does not inherit the step one happens to be on, and it goes back to nothing
  // when the route stops matching
  weak: true,
});
export const ALERT_EDIT_ROUTE = route("/alerts/:alertId/edit", {
  searchParams: { step: stepSignal },
});
```

```jsx
<SlideContainer signal={stepSignal} defaultCurrent={editing ? "recap" : "when"}>
```

That is the whole wiring, and every half of it is the piece that already
existed. Worth naming, because each answers a question a wizard actually has:

- **the param is absent while the step is the default one** (route.js prunes it),
  so `/alerts/W-123/edit` stays clean and `defaultCurrent` is what says where the
  container opens. An empty signal means "wherever this would have opened
  anyway", not "the first slide";
- **the container walks to the step rather than jumping to it.** The address comes
  from outside the box (typed, shared, kept from a session that has moved on), so
  every slide between here and there is asked to let go the way a key going that
  way would ask it, and the first one that holds is where one stops. `?step=done`
  cannot open a confirmation screen for something nobody sent. The signal is then
  written with the area actually shown, so the address never says one is
  somewhere one is not;
- **only the travels that HAPPENED are written.** A travel a lock refused, or one
  `onCurrentChange` refused late, never reaches the signal — or is written back
  when it does.

A container remembers nothing across a reload, so a step whose `required` the app
knows is already satisfied says so itself (`required={!alreadyFilled}`); the same
holds for a hold that a finished job lifts (`preventNavNext={!published}`).

Two containers on one screen are two signals, and that is the whole answer to
"which one owns the param": the one holding the route's signal. A gallery of
seven wizards side by side hands each of them a `useSignal` of its own, and
nothing goes into the address.

### A state whose values ARE places: `history: "push"`

Replacement is the default because most URL-held state qualifies the screen one
is on. A state whose values are places one came from — the photo being looked at
in a gallery — says so where the state is declared:

```js
const photoSignal = stateSignal(undefined, { id: "photo", history: "push" });
```

Every write of it then stacks an entry, wherever the write comes from. Except
where the writer knows this particular move is not one: a slide reached by
DRAGGING replaces even in a container that pushes, because swiping back and forth
with a thumb is browsing, not a trail one wants to walk home along. That is said
at the write rather than declared:

```js
photoSignal.set(nextPhoto, { history: "replace" });
```

`SlideContainer` already does exactly that for its own drags, so a gallery gets
it by declaring the state and nothing else.

### What this is not

It is not a route. Nothing is declared for the steps themselves, nothing matches
on them, and no page transition plays — a transition needs the page to change
([route_transitions.md](./route_transitions.md)), and a search param moving is
not one. What travels is the box, and the address is a label on where the box
stands. A position several parts of the app must react to is still a route.

Demo: [../src/layout/demos/8_slide_container_demo.html](../src/layout/demos/8_slide_container_demo.html).
