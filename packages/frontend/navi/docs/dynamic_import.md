# Code loaded on demand

What an app wants from an `import()` is that **a screen's code arrives the way
its data does**: one wait, one failure, one place that shows both. A module
fetched on demand is a request like any other — it takes time, it fails when
the network is gone or a deploy happened in between — and nothing on screen
should have to know whether what it waits for is bytes of data or bytes of
code.

So navi has nothing lazy-shaped: **the import is an action**, started by what
asks for it — the address through `routeAction`, a state through
`actionRunEffect` — and read by the hook a screen already reads its data
with. Running it from the hook itself is the fallback, as for data.

## A page: its code is a route action

The address asks for the page's data through a route action; it asks for the
page's code the same way, and the two are in flight together from the url
change. The page component in the entry reads the code like data — with
`loading: true` and `error: true`, drawing the page's own pending screen and
its own unavailable screen where the page will stand:

```jsx
const GAME_PAGE_ACTION = routeAction(GAME_ROUTE, GAME.GET, () => ({
  gameId: GAME_ROUTE.paramsSignal.value.gameId,
}));
const GAME_PAGE_CODE = routeAction(GAME_ROUTE, () =>
  import("./game_page.jsx").then((m) => m.GamePage),
);

const GamePage = () => {
  const [Page, loading, error] = useAsyncData(GAME_PAGE_CODE, {
    loading: true,
    error: true,
  });
  if (loading) {
    return <GameScreenPending />;
  }
  if (error) {
    return <GameScreenUnavailable />;
  }
  return <Page />;
};

<Route route={GAME_ROUTE} element={GamePage} />;
```

Why a branch rather than a `<Loading>` around it: suspending takes the
subtree away and puts the boundary's fallback in its place, then mounts the
page again — a cost worth paying when a page already on screen re-reads its
data (see [data_states.md](./data_states.md)), and worth nothing here, where
the page is not there yet and has nothing to keep. `loading: true` never
suspends: one component, no wrapper, the pending screen is the page's own
shape, and the failure sits beside it (what it offers: below, "When the code
does not come"). What is delegated stays delegated — the page's data, read inside
`game_page.jsx` with `useAsyncData(GAME_PAGE_ACTION)`, still waits in the
`<Loading>` written between the routes, as [navigation.md](./navigation.md)
says.

Everything the data layer decides then holds for the code:

- **One failure.** A rejected import fails the run like a failed read; drawn
  by the branch above, or by the nearest `<ErrorBoundary>` when the page reads
  its code without `error: true`.
- **Fetched once.** A route action left behind is aborted, not reset, and a
  completed one is not run again: coming back to the page renders
  synchronously, only the data is asked for per params.
- **Fetched ahead.** A route action that asks nothing of the address is prerun
  on intent (below).
- **Counted.** The routing is busy until the code is there, like for the
  data.

The page module itself is ordinary — it reads its data with
`useAsyncData(GAME_PAGE_ACTION)` like any page — and imports the routes module
back for it; a dynamic import is not a load-order cycle.

## A component inside a page that stays: who asks for its code

A plan drawn on demand inside a page that stays knows where it is drawn and
what stands there — a frame, a line, a button. The wait and the failure are
drawn where the frame is, with `loading: true` and `error: true`, the same way
as for a page. What differs is **who starts the import**, and the order of
preference is the one `useAsyncData` states for data: **the run belongs to
what asks, not to the render.**

1. **The address asks** → `routeAction`, above. A section of a page that has
   an address (`/places/:id/plan`) is a page.
2. **A state asks** → `actionRunEffect`. A plan drawn once a mode is entered,
   a tab chosen, a popup opened: the signal that says so is what starts the
   import, declared once at module scope — one action for every instance,
   started by the state change rather than by the render that follows it,
   and holding its answer across mounts:

   ```jsx
   const PLAN_CODE = actionRunEffect(
     () => import("./plan.jsx").then((m) => m.Plan),
     () => planShownSignal.value,
   );

   const PlanSection = () => {
     const [Plan, loading, error] = useAsyncData(PLAN_CODE, {
       loading: true,
       error: true,
     });
     return (
       <PlanFrame>
         {loading ? <Text>…</Text> : null}
         {error ? <Button action={() => reload()}>Recharger</Button> : null}
         {Plan ? <Plan /> : null}
       </PlanFrame>
     );
   };
   ```

3. **Nothing above the component asks** → `useAsyncData` with a function, the
   fallback: the component's own existence is the only thing that asks, so the
   request is its own, made into an action once on the first render and kept
   for the life of the instance.

   ```jsx
   const [Plan, loading, error] = useAsyncData(
     () => import("./plan.jsx").then((m) => m.Plan),
     { loading: true, error: true },
   );
   ```

   It starts one render late, and per instance: a component fetched this way
   in three places asks three times (the browser fetches the module once), and
   coming back to it suspends for the microtask the import takes to answer
   from the module map. Reach for it when there is genuinely no state to read
   the request off — not to save declaring one.

Delegating instead (the hook without `loading: true`, under a `<Loading>`
around the frame) follows the rule for data: **the `<Loading>` goes where the
fallback should land.** A boundary around the whole router takes the router
away while a page loads — top bar, tabs and all.

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

A prefetch that fails is not reported: nothing on screen asked for it. The
failure stays on the action, where the arrival asks again — a failed action is
run, only a running or completed one is left alone — and shows its own.

The same from code: `route.preload()` for a route something is about to
navigate to, `preloadUrl(url)` for an address. A press that computes its
destination has nothing to preload — the navigation itself asks.

## What a transition photographs

A route element still waiting is what the container rendered — its pending
screen, or the fallback of the boundary it suspended into — so a route
transition or a `RouteTravel` takes its picture of **that**, code and data
alike. Navi does not hold a navigation for a chunk: the honest answer
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

**Asking again never fetches.** The document remembers a module whose fetch
failed as failed: a second `import()` of the same address is refused without a
request, for the life of the document. So a retry on an import has nothing to
do — `error.action.rerun()` fails again at once, on the same failure — and
the one way out is a fresh document: **`reload()`**, which the screen offers
in words the reader understands. Navi does not reload on its own: a document
reloading itself is a loop waiting to happen. It is also why a prefetch that
failed is not asked again on the arrival in any useful sense: the run is made,
refused at once, and the screen says it.

The page or the component reading its code says it where it stands, as
above. A failure left to a boundary — a page reading its code without
`error: true` — reaches it like a failed read does; a boundary that shows only
what came from the network and rethrows the rest as a bug recognises an import
by its action — `error.action` is the route action the app declared for the
code — rather than by the browser's message.

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
