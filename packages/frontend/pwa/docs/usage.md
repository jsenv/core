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
  meta, // object returned by the service worker script to the "inspect" action ({} otherwise)
  update: {
    error,
    readyState, // "" | "installing" | "installed" | "activation_pending" | "activating" | "activated" | "redundant"
    meta, // meta of the new service worker script
    reloadRequired, // false when every changed resource has an update handler
  },
}
```

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
};
```

The browser activates the update only once the current worker has finished
its in-flight events (a fetch it is still answering on a slow network, for
instance): the promise can stay pending for a while, and it rejects when the
update is discarded (`update.readyState === "redundant"`) or refuses. Draw the
progress from `update.readyState` (`"activation_pending"` while the current
worker holds the switch, then `"activating"`, `"activated"`) rather than
keeping a control busy on the promise; `update.error` holds the failure.

Once the update controls the page, every client tab reloads so no stale
resource stays alive. To update some resources in place instead of reloading
(requires a service worker script implementing the jsenv protocol, e.g.
`@jsenv/service-worker`, so resources can be diffed between versions):

```js
swFacade.defineResourceUpdateHandler("/img/logo.png", {
  replace: ({ toUrl }) => {
    document.querySelector("#logo").src = toUrl;
  },
  // add: ({ toUrl }) => {...},
  // remove: ({ fromUrl }) => {...},
});
```

The page reloads anyway if at least one changed resource has no handler
(`state.update.reloadRequired` tells which case you are in).

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
