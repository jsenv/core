# Code loaded on demand

What an app wants from an `import()` is that **a screen's code arrives the way
its data does**: one wait, one failure, one place that shows both. A module
fetched on demand is a request like any other — it takes time, it fails when
the network is gone or a deploy happened in between — and nothing on screen
should have to know whether what it waits for is bytes of data or bytes of
code.

So navi has nothing lazy-shaped: **the import is an action**, read by the hook
a screen already reads its data with. Two shapes, decided by who asks.

## A page: its code is a route action

The address asks for the page's data through a route action; it asks for the
page's code the same way, and the two are in flight together from the url
change:

```jsx
const GAME_PAGE_ACTION = routeAction(GAME_ROUTE, GAME.GET, () => ({
  gameId: GAME_ROUTE.paramsSignal.value.gameId,
}));
const GAME_PAGE_CODE = routeAction(GAME_ROUTE, () =>
  import("./game_page.jsx").then((m) => m.GamePage),
);

const GamePage = () => {
  const [Page] = useAsyncData(GAME_PAGE_CODE);
  return <Page />;
};

<Route>
  <ErrorBoundary fallback={PageError}>
    <Loading fallback={<PageSkeleton />}>
      <Route route={GAME_ROUTE} element={GamePage} />
    </Loading>
  </ErrorBoundary>
</Route>;
```

Everything the data layer decides then holds for the code, with nothing more
to write:

- **One wait.** The page suspends into the nearest `<Loading>` on whichever of
  the two arrives last; the boundary is told it is loading and draws its
  fallback; the routing is busy until both are there.
- **One failure.** A rejected import fails the run: the nearest
  `<ErrorBoundary>` shows it, `error.action.rerun()` is the way back, going
  somewhere else leaves it behind.
- **Fetched once.** A route action left behind is aborted, not reset, and a
  completed one is not run again: coming back to the page renders
  synchronously, only the data is asked for per params.
- **Fetched ahead.** A route action that asks nothing of the address is prerun
  on intent (below).

The page module itself is ordinary — it reads its data with
`useAsyncData(GAME_PAGE_ACTION)` like any page — and imports the routes module
back for it; a dynamic import is not a load-order cycle.

## A component inside a page that stays: it reads its own code

A plan drawn on demand inside a page that stays knows where it is drawn and
what stands there — a frame, a line, a button. `useAsyncData` takes a
function: the request this component owns, made into an action once on the
first render and kept for the life of the instance, its answer as the data.
The wait and the failure are then drawn where the frame is, and no boundary is
involved:

```jsx
const PlanSection = () => {
  const [Plan, loading, error] = useAsyncData(
    () => import("./plan.jsx").then((m) => m.Plan),
    { loading: true, error: true },
  );
  return (
    <PlanFrame>
      {loading ? <Text>…</Text> : null}
      {error ? (
        <Button action={() => error.action.rerun()}>Réessayer</Button>
      ) : null}
      {Plan ? <Plan /> : null}
    </PlanFrame>
  );
};
```

Delegating instead (`useAsyncData(fn)` alone, under a `<Loading>` around the
frame) is the same hook with the same rule as for data: **the `<Loading>` goes
where the fallback should land.** A boundary around the whole router takes the
router away while a page loads — top bar, tabs and all.

This shape starts at the render and is per instance: a component fetched this
way in three places asks three times (the browser fetches the module once),
and coming back to it suspends for the microtask the import takes to answer
from the module map. A page wants the route action shape; a section inside a
page rarely notices.

Nothing has to be kept out of a subtree loaded this way: the suspension
happens before the module's components exist, so nothing inside it is parked
by the code arriving.

## Ahead of the render: intent

**A link preloads where it leads when the pointer or the focus reaches it.**
`<Link>` and `<Button>` with an `href` or a `route` do it by default;
`prefetch={false}` opts one out. The url is matched against the routes on
screen, a section and the page inside it alike, and what is prerun is **every
route action that asks nothing of the address** — a page's code, a read
without params. An action whose params come from the address is never
prefetched: a prefetch has no address, the id may still be chosen.
`routeAction(route, action, undefined, { prefetch: false })` keeps a
param-less read that is not worth a hover out of it.

A prefetch that fails is forgotten, not reported: nothing on screen asked for
it. The arrival asks again and shows its own failure.

The same from code: `route.preload()` for a route something is about to
navigate to, `preloadUrl(url)` for an address. A press that computes its
destination has nothing to preload — the navigation itself asks.

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

## When the code does not come

Someone has the app open, a deploy moves the chunks, and the next `import()`
is a 404; or the network is gone. The browser says both the same way — a
`TypeError` with no status — and neither is a bug of the page: there is
nothing in the app's code to point at.

The component reading its own code says it where it stands, as above. For a
page, the failure reaches the boundary like a failed read does; a boundary
that shows only what came from the network and rethrows the rest as a bug
recognises an import by its action — `error.action` is the route action the
app declared for the code — rather than by the browser's message. Either way
`error.action.rerun()` retries; a retry failing the same way says the document
is stale, and **reloading it** is what brings the new code. Navi does not do
it on its own — a document reloading itself is a loop waiting to happen — the
screen says it.

## Preact's `lazy()` is not this

`preact/compat` has a `lazy()`. It suspends without saying anything to
`<Loading>`: the boundary keeps the last reason it knows — "idle" by default —
and draws nothing while the module loads; a failure is not an action's, so no
`rerun` brings the page back. Navi warns in dev when a `<Loading>` catches a
suspension it cannot attribute to an action. Read the import through an
action.

## The build

Every `import()` becomes a chunk of its own under `js/`, versioned with the
rest, and a target without dynamic import gets the fallback. Nothing to
configure.

## Reference

- `src/nav/demos/code_splitting/code_splitting_demo.html` — two pages whose
  code is a route action, one prefetched on hover and one opted out, and a
  component inside a page that stays, drawing its own wait and failure; every
  import is drawn on the backend's frontier so a wait or a failure can be
  played by hand.
- `src/nav/route_action.js`, `src/nav/use_preload_on_intent.js`
