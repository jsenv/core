# @jsenv/pwa usage

Complete examples for each feature. Every feature is independent — pick what
you need.

## Service worker: register + auto-managed lifecycle

```js
import { createServiceWorkerFacade } from "@jsenv/pwa";

const swFacade = createServiceWorkerFacade();
swFacade.setRegistrationPromise(navigator.serviceWorker.register("/sw.js"));
```

That's enough to have the service worker registered and the facade tracking
its lifecycle. `swFacade.state.readyState` progresses through
`"registering"`, `"installing"`, `"installed"`, `"activating"`, `"activated"`
(or `"redundant"` when replaced / discarded).

`createServiceWorkerFacade` accepts options:

```js
createServiceWorkerFacade({
  scope: "/app/", // registration scope to look up; defaults to the origin
  autoclaimOnFirstActivation: true, // first worker controls the page immediately
});
```

`autoclaimOnFirstActivation` matters because **everything about updates assumes
a controlled page**: a worker arriving on a registration that controls no
client activates straight away, without ever waiting, so no update is announced
— it just takes over. Until `navigator.serviceWorker.controller` is set the
page sees no `"installed"` update, which is also why a test or a screenshot run
must wait for that controller before expecting one.

## Service worker: reacting to state

`swFacade.subscribe(callback)` runs the callback immediately and again on every
state change:

```js
swFacade.subscribe(() => {
  const { readyState, update, error } = swFacade.state;
  if (error) {
    console.error("service worker failed", error);
  }
  console.log(`worker: ${readyState}, update: ${update.readyState}`);
});
```

State shape:

```js
{
  error, // Error or ErrorEvent, null while all good
  readyState, // "" | "registering" | "installing" | "installed" | "activating" | "activated" | "redundant"
  meta, // "inspect" meta of registration.active || waiting || installing ({} otherwise)
  update: {
    error,
    readyState, // "" | "installing" | "installed" | "activation_pending" | "activating" | "activated" | "redundant"
    meta, // meta of the new service worker script
    reloadRequired, // false when every changed resource has an update handler
  },
}
```

`state.meta` is the meta of the worker the _registration_ points at, which is
not necessarily the worker controlling the page (an uncontrolled page still has
a registration, and a page can outlive a controller change). For "the worker
that actually serves this page", read `navigatorControllerSignal`; for "the
version this page is running", see the note under
[Service worker: updates](#service-worker-updates).

## Service worker: updates

The browser looks for updates on navigation and every 24h; call
`checkForUpdates()` to ask explicitly:

```js
const updateCheckButton = document.querySelector("#update_check");
updateCheckButton.onclick = async () => {
  const found = await swFacade.checkForUpdates();
  if (!found) {
    console.log("no update found");
  }
};
```

When an update is found it installs in the background;
`state.update.readyState` becomes `"installed"` once it waits to activate.
By default the new worker activates only after all tabs are closed; to
activate it right away (typical "a new version is available, update now"
button):

```js
swFacade.subscribe(() => {
  const { update } = swFacade.state;
  updateButton.hidden = update.readyState !== "installed";
});
updateButton.onclick = async () => {
  await swFacade.activateUpdate(); // skipWaiting + claim
  await swFacade.reloadClients(); // restart, when the app decides to
};
```

**`update.readyState === "installed"` means different script _bytes_, not a
different _payload_.** The page can already be running the build the waiting
worker carries: a document fetched outside the active worker's cache comes from
the latest deployment while that worker still caches the previous one, so the
new worker installs and waits next to a page that is already up to date. A UI
saying only "a new version is available" never notices; a UI printing version
numbers prints the same number on both sides of its arrow.

Neither `state.meta` nor `state.update.meta` can settle it: both describe
_workers_, and no worker describes the document currently executing. So a
version-aware UI must compare `state.update.meta` with what the running bundle
knows about itself:

```js
// APP_VERSION is baked into the bundle at build time
const version = swFacade.state.update.meta?.appVersion ?? null;
const updateIsNew = version !== null && version !== APP_VERSION;
```

The browser activates the update only once the current worker has finished
its in-flight events (a fetch it is still answering on a slow network, for
instance): the promise can stay pending for a while, and it rejects when the
update is discarded (`update.readyState === "redundant"`) or refuses. Draw the
progress from `update.readyState` (`"activation_pending"` while the current
worker holds the switch, then `"activating"`, `"activated"`) rather than
keeping a control busy on the promise; `update.error` holds the failure.

### Restarting is the app's call

`activateUpdate()` stops at "the update controls the page"; nothing reloads
until the app calls `swFacade.reloadClients()`, which asks the service worker
to tell every client tab — this page included — to reload.

The two steps are separate because the second one throws away the document
that would say it worked. Activating and reloading in the same tick makes the
popover the person was in disappear and the screen behind it redraw, with no
acknowledgement anywhere; splitting them lets the same popover turn into its
"it's installed, restart when you want" state and keeps the restart an
explicit gesture. Doing both back to back is one line:

```js
await swFacade.activateUpdate();
await swFacade.reloadClients();
```

Between the two the page runs on the new worker while the cache it was served
from is gone, so a resource fetched lazily comes from the new build or the
network. Keep the window short — it is meant for an acknowledgement and a
button, not for staying there.

`reloadClients()` goes through the service worker on purpose: a tab that never
activated anything is running the old build against a cache that no longer
exists, so every client reloads together.

To update some resources in place instead of reloading (requires a service
worker script implementing the jsenv protocol, e.g. `@jsenv/service-worker`,
so resources can be diffed between versions):

```js
swFacade.defineResourceUpdateHandler("/img/logo.png", {
  replace: ({ toUrl }) => {
    document.querySelector("#logo").src = toUrl;
  },
  // add: ({ toUrl }) => {...},
  // remove: ({ fromUrl }) => {...},
});
```

`state.update.reloadRequired` tells which case you are in: it is `false` when
every changed resource was replaced in place, `true` when a restart is still
owed.

## Service worker: communication

```js
// in sw.js
self.addEventListener("message", ({ data, ports }) => {
  if (data === "ping") {
    ports[0].postMessage("pong");
  }
});

// in the page
const response = await swFacade.sendMessage("ping");
console.log(response); // "pong"
```

## Service worker: unregister

```js
await swFacade.unregister();
```

## Add to home screen

The page must capture `beforeinstallprompt` as early as possible, in a classic
inline script placed before any module, and store the event on
`window.beforeinstallpromptEvent` (storing it anywhere else breaks repeated
prompts, see `src/add_to_home_screen.js`):

```html
<script>
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    window.beforeinstallpromptEvent = event;
  });
</script>
```

Then:

```js
import { addToHomescreen } from "@jsenv/pwa";

const installButton = document.querySelector("#install");
addToHomescreen.availableSignal.subscribe((available) => {
  installButton.disabled = !available;
});
installButton.onclick = async () => {
  const accepted = await addToHomescreen.prompt(); // must run in a user gesture
  console.log(accepted ? "installed" : "declined");
};
```

`listenAppInstalled(callback)` fires on installation however it happened
(prompt or browser toolbar):

```js
import { listenAppInstalled } from "@jsenv/pwa";

listenAppInstalled(() => {
  console.log("app installed");
});
```

## Display mode

```js
import { displayModeStandaloneSignal } from "@jsenv/pwa";

displayModeStandaloneSignal.subscribe((standalone) => {
  console.log(standalone ? "running as installed app" : "running in browser");
});
```

## Which service worker controls the page

```js
import { navigatorControllerSignal } from "@jsenv/pwa";

navigatorControllerSignal.subscribe((controller) => {
  // null when not controlled, otherwise { meta }
  console.log("controller:", controller);
});
```

## Debugging

```js
import { pwaLogger } from "@jsenv/pwa";

pwaLogger.setOptions({ logLevel: "debug" });
```
