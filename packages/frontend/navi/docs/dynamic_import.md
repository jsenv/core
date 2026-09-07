# Code loaded on demand

What an app wants from an `import()` is that **a screen's code arrives the way
its data does**: one wait, one failure, one place that shows both. A module
fetched on demand is a request like any other — it takes time, it fails when
the network is gone or a deploy happened in between — and nothing on screen
should have to know whether what it waits for is bytes of data or bytes of
code.

## The import is an action

`lazy()` turns a loader into a component whose code is an action:

```jsx
import { lazy } from "@jsenv/navi";

const GamePage = lazy(() => import("./game_page.jsx"));

<Route>
  <ErrorBoundary fallback={PageError}>
    <Loading fallback={<PageSkeleton />}>
      <Route route={GAME_ROUTE} element={GamePage} />
    </Loading>
  </ErrorBoundary>
</Route>;
```

Everything the data layer already decides then holds for the code, with
nothing more to write:

- **It starts with the data.** The route action runs on the url change; the
  import starts from the render the match triggers, a microtask later — or
  earlier, on intent (below). The two are in flight together, and the page
  suspends on whichever arrives last.
- **One wait.** The import suspends into the nearest `<Loading>` like a
  `useAsyncData` does — the boundary is told it is loading, and draws its
  fallback. It counts in the document's busy state like a route action.
- **One failure.** A rejected import fails the run: the nearest
  `<ErrorBoundary>` shows it, `error.action.rerun()` is the way back, and going
  somewhere else leaves it behind. A module missing after a deploy is an error
  the screen already knows how to show.
- **Fetched once.** A completed run is not run again: coming back to the page
  renders synchronously, only the data is asked for per params.

The loader resolves to the component itself or to the module: its `default`
export, or its only exported function. A module exporting several says which
by returning it from the loader — and two `lazy()` on the same module cost one
fetch, the browser holds a module once:

```js
const PlanThumbnail = lazy(() => import("./plan.jsx").then((m) => m.PlanThumbnail));
const PlanDialog = lazy(() => import("./plan.jsx").then((m) => m.PlanDialog));
```

## Where the boundary goes

The rule of the data layer applies unchanged: **the `<Loading>` goes where the
fallback should land**, and a `lazy()` element needs one above it exactly as a
page reading its data does. A boundary around the whole router takes the
router away while a page loads — top bar, tabs and all — and puts the fallback
in its place. Written between the container and its branches, it holds the
page's box and nothing else (see [navigation.md](./navigation.md), "Loading
data"). A component fetched on demand inside a page that stays gets its own
`<Loading>` around it, with the frame of what it stands in for as the
fallback.

Nothing has to be kept out of a subtree loaded this way: the suspension
happens before the module's components exist, so nothing inside it is parked
by the code arriving. A subtree parked later is parked by a data suspension,
which is the same story with or without a split.

## Ahead of the render: intent

**A link fetches the code of where it leads when the pointer or the focus
reaches it.** `<Link>` and `<Button>` with an `href` or a `route` do it by
default; `prefetch={false}` opts one out — a destination not worth fetching on
a hover. The url is matched against the routes on screen, a section and the
page inside it alike, and each fetches what its router registered for it.

Two things are deliberately NOT part of it:

- **Only code is fetched, never data.** The data is the route action's, asked
  for on arrival with the params the address holds. A prefetch has no such
  address yet — the id may still be chosen — and a read ahead of need is a
  decision the app takes itself, with `prerun()` on the binding it wants warm.
- **A prefetch that fails is forgotten**, not reported: nothing on screen asked
  for it. The visit that needs the code asks again and shows its own failure.

The same fetch, from code: `route.preload()` for a route something is about to
navigate to, `preloadUrl(url)` for an address. A press that computes its
destination has nothing to preload — the navigation itself fetches the code.

Which routers know: a route's lazy elements register when the router holding
them renders. A section whose sub-router is inside its own chunk registers its
pages once the section is on screen; before that, intent on a link to a
sub-page fetches the section.

## What a transition photographs

A route element still waiting is announced as rendered by its boundary, so a
route transition or a `RouteTravel` takes its picture of the **fallback**, code
and data alike. Navi does not hold a navigation for a chunk: the honest answer
to "a chunk is a hundred milliseconds" is the prefetch above — the code is
there before the press — and a skeleton that is the page's own shape is what
gets photographed when it is not.

## `import.meta.css` on the far side of a split

A module's stylesheet ships **inside its chunk** and is adopted when the
assignment runs (see [css_architecture.md](./css_architecture.md)). Three
consequences:

- **The fallback cannot use a class the lazy module defines.** It is rendered
  by the eager side, before the chunk exists. The frame of what it stands in
  for — background, border, aspect ratio — belongs to the eager module, the
  lazy one owning only the inside; duplicating the frame into the eager side
  is the same answer.
- **Layers are what the text says.** `@layer navi` holds navi's defaults
  whether the sheet came with the entry or with a chunk, and an app's unlayered
  rule wins over it from either side.
- **Between unlayered sheets, the last adopted wins at equal specificity.** A
  chunk's sheet lands after everything already adopted, so a chunk beats the
  entry; between two chunks the order is the order they ran in, which nothing
  in the build fixes. A rule that depends on it is a rule to make more
  specific.

## Preact's `lazy()` is not this one

`preact/compat` has a `lazy()` too. It suspends without saying anything to
`<Loading>`: the boundary keeps the last reason it knows — "idle" by default —
and draws nothing while the module loads; a failure is not an action's, so no
`rerun` brings the page back. Navi warns in dev when a `<Loading>` catches a
suspension it cannot attribute to an action. Import `lazy` from navi.

## The build

Every `import()` becomes a chunk of its own under `js/`, versioned with the
rest, and a target without dynamic import gets the fallback. Nothing to
configure.

## Reference

- `src/nav/demos/code_splitting/code_splitting_demo.html` — two pages fetched
  on demand next to a route action, one prefetched on hover and one opted out,
  with the import drawn on the backend's frontier so both waits can be watched.
- `src/state/async/lazy.jsx`, `src/nav/use_preload_on_intent.js`
