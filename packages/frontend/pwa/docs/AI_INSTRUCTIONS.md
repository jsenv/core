# @jsenv/pwa — context for AI assistants

This file gives context for using `@jsenv/pwa` as intended, whether you're
reading the source directly or inside `node_modules/@jsenv/pwa/`. The package
ships its source unbundled: every export in `src/main.js` carries JSDoc in its
source file — read that JSDoc first, it is the API reference.

## What the package provides

Three independent features (use any of them alone):

- **Service worker lifecycle** — `createServiceWorkerFacade()` wraps
  registration, update detection, update activation and messaging behind one
  object with reactive state. This is the core of the package.
- **Add to home screen** — `addToHomescreen` (availability ref + `prompt()`),
  `listenAppInstalled()`, `displayModeStandaloneRef`.
- **Introspection** — `navigatorControllerRef` (which service worker controls
  the page), `pwaLogger` (set `logLevel: "debug"` to see what the package does).

## Key concepts to know before guessing an API

- **Reactive refs, not getter/listener pairs**: `addToHomescreen.availableRef`,
  `displayModeStandaloneRef` and `navigatorControllerRef` are "sigref" objects
  from `@jsenv/sigi`: read `ref.value`, and `ref.subscribe(callback)` calls the
  callback immediately with the current value and again on every change,
  returning an unsubscribe function. There is no `isAvailable()` /
  `listenAvailabilityChange()` style API.
- **The facade holds reactive state**: `swFacade.state` is a plain-looking
  object (`error`, `readyState`, `meta`, `update: { error, readyState, meta,
reloadRequired }`) and `swFacade.subscribe(callback)` re-runs the callback
  when any state it reads changes. `readyState` progresses through
  `"registering" → "installing" → "installed" → "activating" → "activated"`
  (or `"redundant"`); `state.update.readyState === "installed"` means an update
  is ready to be activated with `swFacade.activateUpdate()`.
- **You register the service worker yourself**: call
  `navigator.serviceWorker.register(url)` and hand the promise to
  `swFacade.setRegistrationPromise(...)`. The facade never chooses the script
  URL.
- **The service worker script side has a protocol**: messaging features
  ("inspect" meta, `activateUpdate()`, hot resource replacement) expect the
  service worker script to answer `{ action }` messages on a MessageChannel
  port. `@jsenv/service-worker` implements it. With a plain script everything
  degrades gracefully: meta stays `{}` and updates fall back to a full page
  reload.
- **Pages reload after an update by design**: once an update activates and
  controls the page, all client tabs reload so no stale resource survives —
  unless every changed resource has a handler registered via
  `swFacade.defineResourceUpdateHandler(url, handler)`.
- **`beforeinstallprompt` must be captured early by the page itself** (inline
  classic script storing the event on `window.beforeinstallpromptEvent`) —
  see the JSDoc on `addToHomescreen` for the exact snippet and why it must not
  be wrapped.

## More context

- `docs/usage.md` — complete copy-pasteable usage examples for each feature.
- `README.md` (package root) — overview and API reference.
- Source on GitHub:
  https://github.com/jsenv/core/tree/main/packages/frontend/pwa/src
