# @jsenv/service-worker — context for AI assistants

This file gives context for using `@jsenv/service-worker` as intended, whether
you're reading the source directly or inside `node_modules/@jsenv/service-worker/`.
The package is a single classic worker script,
`src/jsenv_service_worker.js`; the JSDoc on `sw.init` in that file is the API
reference.

## What it is

A ready-made service worker implementation: cache a list of resources during
"install", serve them from cache in "fetch" (offline support), clean previous
caches during "activate". It is the service-worker-side counterpart of
`@jsenv/pwa` (the page-side facade) and integrates with `@jsenv/core`'s build.

## Key concepts to know before guessing an API

- **It's not a module**: the service worker file loads it with
  `self.importScripts("./node_modules/@jsenv/service-worker/src/jsenv_service_worker.js")`
  then calls `self.__sw__.init({ ... })`. There are no ES exports.
- **`init` options** (all optional): `name`, `version`, `meta`, `logLevel`,
  `resources`, `actions`, `install`, `activate` — see the JSDoc on `sw.init`.
  Anything else (cache expiration, per-resource fetch strategies, precache
  priorities) is NOT supported; don't invent options.
- **`resources`** maps urls to `{}` (unversioned, refetched on every install)
  or `{ version, versionedUrl }` (immutable, fetched once). Urls resolve
  against the service worker location.
- **jsenv build integration**: when a project built with `@jsenv/core` calls
  `navigator.serviceWorker.register(...)`, the build detects the worker script
  and prepends `self.resourcesFromJsenvBuild` — every build resource with its
  version and versioned url. The service worker file spreads it into
  `resources`. Nothing to configure on the build side.
- **Message protocol**: the page communicates via `{ action, payload }`
  messages carrying a MessageChannel port (this is what `@jsenv/pwa`'s
  `sendMessage`/facade uses). Built-in actions: `inspect`, `skipWaiting`,
  `claim`, `postReloadAfterUpdateToClients`, `refreshCacheKey`, `addCacheKey`,
  `removeCacheKey`. Custom ones go through `init({ actions })` or
  `self.__sw__.registerActions({ ... })`.
- **Updates**: each worker version gets its own cache (name derived from
  `name` + hash of version/resources); the new worker caches everything during
  install while the old one still serves, then deletes previous caches during
  activate. `@jsenv/pwa` on the page side diffs the two workers' `inspect`
  results to hot-replace individual resources instead of reloading, unless
  `version` differs.

## More context

- `docs/usage.md` — copy-pasteable setup: service worker file, page
  registration with `@jsenv/pwa`, build integration.
- `README.md` (package root) — overview and configuration reference.
- Source on GitHub:
  https://github.com/jsenv/core/tree/main/packages/frontend/service-worker/src
