# @jsenv/service-worker — context for AI assistants

This file gives context for using `@jsenv/service-worker` as intended, whether
you're reading the source directly or inside `node_modules/@jsenv/service-worker/`.

The package is one classic worker script, `src/jsenv_service_worker.js`,
published as-is (no `dist/`): what ships in `node_modules` is the source with
its JSDoc. The JSDoc on `self.__sw__.init` and `self.__sw__.registerActions`
in that file is the API reference.

## What it is

A ready-made service worker implementation, precache-oriented: cache a list of
resources during "install", serve them from cache in "fetch" (offline
support), clean the previous caches during "activate". It is the
service-worker-side counterpart of `@jsenv/pwa` (the page-side facade), and
`@jsenv/core`'s build hands it the list of build outputs.

## Where the answer to "how do I use it" is

There is no reference page per option, and there will not be one: the code is
small and its JSDoc is right there. Each source of knowledge has one job:

- **JSDoc on `sw.init`** — what each option means and accepts, and the traps
  around `resources`. Read it first; it is what an editor shows on hover.
- **`docs/usage.md`** — copy-pasteable setup: the worker file, registering
  from the page (with and without `@jsenv/pwa`), the build integration,
  custom actions, debugging.
- **The tests, in the repo only** (not published):
  https://github.com/jsenv/core/tree/main/packages/frontend/service-worker/tests
  - `tests/update/project/client/` — a complete page + worker: registration
    UI, update check, "update now" vs "restart to update", hot replacement of
    an image without reload (`sw_facade.js`, `main.js`, `sw.js`), driven by
    `update_build_server.mjs` which rebuilds the project on demand. The
    closest thing to a demo.
  - `tests/errors/project/src/` — what happens when the worker throws at top
    level, during install, or during activate.
- **This file** — the concepts and invariants below: what the code cannot say
  on its own.

## Key concepts to know before guessing an API

- **It is a classic script, not a module**: a service worker file loads it
  with `importScripts`, then calls `self.__sw__.init({ ... })`. There are no
  ES exports; everything hangs on `self.__sw__`.
  - In a project served or built by jsenv,
    `self.importScripts("@jsenv/service-worker")` works: jsenv resolves bare
    specifiers in `importScripts` the way it does in `import` (dev server and
    build alike).
  - Without jsenv, give the path to the file, relative to the worker file's
    own url:
    `self.importScripts("./node_modules/@jsenv/service-worker/src/jsenv_service_worker.js")`.
  - A worker registered with `{ type: "module" }` cannot call
    `importScripts` (the browser throws); this package targets classic
    workers.
- **`init` options** (all optional): `name`, `version`, `meta`, `logLevel`,
  `logBackgroundColor`, `logColor`, `resources`, `actions`, `install`,
  `activate` — see the JSDoc. Anything else (cache expiration, per-resource
  fetch strategies, runtime caching of unlisted urls, precache priorities) is
  NOT supported; don't invent options.
- **`resources` is a precache list, nothing more.** Keys are urls (relative
  ones resolve against the worker's url; other origins are allowed). Values
  are `{}` (unversioned: refetched at every install, bypassing the HTTP cache)
  or `{ version, versionedUrl }` (build output: `versionedUrl` is fetched
  normally, so the HTTP cache can answer; requests for either url are then
  served from the worker's cache). A request for anything not listed — and
  any non GET/HEAD request — is left to the browser as if there were no
  worker.
- **Never list the worker script itself** in `resources`: the browser must
  refetch it to detect an update. jsenv's build leaves it out of
  `self.resourcesFromJsenvBuild` and never versions its url.
- **jsenv build integration** — when a page built with `@jsenv/core` calls
  `navigator.serviceWorker.register(...)` (or `window.navigator...`; the url
  as a string, a `new URL(..., import.meta.url)` or `import.meta.resolve()`;
  with or without `{ type: "module" }`), the build:
  - treats the worker file as an entry point of its own: what it loads with
    `importScripts` is copied to the build and versioned, referenced through
    `self.__v__(...)` — a classic worker is not bundled;
  - prepends `self.resourcesFromJsenvBuild = { ... }`: every file of the
    build, `{ version, versionedUrl }` for versioned ones, `{ version }` for
    the entry html (an entry's url stays stable). Spreading it into
    `resources` is the whole integration; nothing to configure build-side.
  - That list holds `/main.html` (the entry), not `/`: keep `"/": {}` by hand
    when the page is reached at the origin root.
  - With `versioning: false` the entries carry no `version`: the worker bytes
    then don't change when a file's content does, so the browser finds no
    update. Keep versioning on (the default) for a worker to be useful.
  - A value the worker needs at build time (a name, an environment) goes
    through the build's `injections` option, like for any file.
  - Unbuilt (dev server), `self.resourcesFromJsenvBuild` is undefined: only
    what the file lists by hand is cached.
- **Message protocol** (what `@jsenv/pwa`'s `sendMessage` speaks): the page
  posts `{ action, payload }` with a `MessageChannel` port; the worker calls
  the matching action with `payload` and answers on the port with
  `{ actionResultStatus: "resolved" | "rejected", actionResultValue }`.
  Built-in actions: `inspect` (→ `{ name, version, resources, ...meta }`),
  `skipWaiting`, `claim`, `postReloadAfterUpdateToClients`, and
  `refreshCacheKey` / `addCacheKey` / `removeCacheKey` (payload: a url).
  Custom ones go through `init({ actions })` or
  `self.__sw__.registerActions({ ... })`. Payload and result travel by
  `postMessage`, so they must be structured-cloneable. `@jsenv/pwa` gives
  `inspect` one second before treating meta as `{}`: `meta` is a plain value
  known at `init` time, not something computed later.
- **Updates**: each worker version owns a cache named
  `${name}_${hash(version + resources)}` — deterministic on purpose: the
  browser kills an idle worker and re-runs the script on the next event, so a
  name built from time or randomness would point at an empty cache after
  every wake-up. The new worker fills its cache during install while the old
  one still serves; on activate it deletes the other `${name}_*` caches (so
  renaming `name` orphans the previous caches). Page-side, `@jsenv/pwa` diffs
  the two workers' `inspect` results and hot-replaces resources instead of
  reloading only when `version` is unchanged, at least one resource changed,
  and every changed resource has a `defineResourceUpdateHandler`. Bump
  `version` when the new worker code must force a reload — not at every
  build, or hot replacement never happens.

## Things not to do

- Hand-write the list of build outputs in `resources`: spread
  `self.resourcesFromJsenvBuild`.
- Add runtime caching by listening to `fetch` beside `init`: the worker
  answers only for listed urls by design; anything else is the browser's.
- Rely on `addCacheKey` to make a url part of the app's offline set: it fills
  the current worker's cache only; the next worker version starts again from
  `resources`.
- Expect cross-origin files (fonts, CDN scripts) to be cached: they are not
  part of the build; add them to `resources` by hand.

## More context

- `docs/usage.md` — copy-pasteable setup: service worker file, page
  registration with `@jsenv/pwa`, build integration, custom actions.
- `README.md` (package root) — overview and configuration reference.
- `@jsenv/pwa`'s `docs/AI_INSTRUCTIONS.md` — the page side: facade state,
  `checkForUpdates()`, `activateUpdate()`, `defineResourceUpdateHandler()`.
- Source on GitHub:
  https://github.com/jsenv/core/tree/main/packages/frontend/service-worker/src
