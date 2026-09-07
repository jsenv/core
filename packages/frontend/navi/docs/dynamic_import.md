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
  import starts from the render the match triggers, a microtask later. The two
  are in flight together, and the page suspends on whichever arrives last.
- **One wait.** The import suspends into the nearest `<Loading>` like a
  `useAsyncData` does — the boundary is told it is loading, and draws its
  fallback.
- **One failure.** A rejected import fails the run: the nearest
  `<ErrorBoundary>` shows it, `error.action.rerun()` is the way back, and going
  somewhere else leaves it behind. A module missing after a deploy is an error
  the screen already knows how to show.
- **Fetched once.** A completed run is not run again: coming back to the page
  renders synchronously, only the data is asked for per params.

The loader resolves to the component itself or to the module: its `default`
export, or its only exported function. A module exporting several says which
by returning it from the loader.

The rule of the data layer applies unchanged: a `lazy()` element needs a
`<Loading>` above it, exactly as a page reading its data does — the boundary is
where the wait lands.

## Ahead of the render: `preload()`

`GamePage.preload()` starts the fetch before anything renders it — on a link
hovered or focused, on an idle moment after startup. It is a prerun: nothing on
screen asked for it, so a prefetch that fails is forgotten rather than
reported, and the visit that needs the code asks again and shows its own
failure.

```jsx
<Link route={STATS_ROUTE} onPointerEnter={StatsPage.preload}>
  Statistiques
</Link>
```

## Preact's `lazy()` is not this one

`preact/compat` has a `lazy()` too. It suspends without saying anything to
`<Loading>`: the boundary keeps the last reason it knows — "idle" by default —
and draws nothing while the module loads; a failure is not an action's, so no
`rerun` brings the page back. Import `lazy` from navi.

## The build

Every `import()` becomes a chunk of its own under `js/`, versioned with the
rest; `import.meta.css` inside it is adopted when the chunk runs, and a target
without dynamic import gets the fallback. Nothing to configure.

## Reference

- `src/nav/demos/code_splitting/code_splitting_demo.html` — two pages fetched
  on demand next to a route action, one preloaded on hover, with the import
  drawn on the backend's frontier so both waits can be watched.
- `src/state/async/lazy.jsx`
