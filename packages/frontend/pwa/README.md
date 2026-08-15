# @jsenv/pwa [![npm package](https://img.shields.io/npm/v/@jsenv/pwa.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/pwa)

A toolkit to implement progressive web application (PWA) features in your website.

🏠 Add to home screen functionality  
🔄 Service worker lifecycle management  
📱 Display mode detection  
🛠️ Simple APIs for complex PWA features

Complete usage examples live in [docs/usage.md](./docs/usage.md); every export
also carries JSDoc in its source file.

## Installation

```console
npm install @jsenv/pwa
```

## Add to Home Screen

Allow users to add your website to their device homescreen, running it in a standalone mode without browser UI.

### Usage Example

```html
<!doctype html>
<html>
  <head>
    <title>PWA Demo</title>
    <meta charset="utf-8" />
    <script type="importmap">
      {
        "imports": {
          "@jsenv/pwa": "./node_modules/@jsenv/pwa/src/main.js"
        }
      }
    </script>
  </head>
  <body>
    <button id="add-to-home-screen" disabled>Add to home screen</button>

    <!-- Capture beforeinstallprompt early, before any module loads -->
    <script>
      window.addEventListener(
        "beforeinstallprompt",
        (beforeinstallpromptEvent) => {
          beforeinstallpromptEvent.preventDefault();
          window.beforeinstallpromptEvent = beforeinstallpromptEvent;
        },
      );
    </script>

    <script type="module">
      import { addToHomescreen } from "@jsenv/pwa";

      const button = document.querySelector("#add-to-home-screen");

      // Called immediately with the current value, then on every change
      addToHomescreen.availableRef.subscribe((available) => {
        button.disabled = !available;
      });

      button.onclick = async () => {
        const accepted = await addToHomescreen.prompt();
        console.log(accepted ? "User accepted" : "User declined");
      };
    </script>
  </body>
</html>
```

### API Reference

#### addToHomescreen.availableRef

A reactive ref telling if the "Add to Home Screen" prompt can be shown.
`availableRef.value` is a boolean; `availableRef.subscribe(callback)` calls the
callback immediately with the current value and again on every change, and
returns an unsubscribe function.

The prompt is available when the browser has fired `beforeinstallprompt`, the
app is not already installed, and the page is not already running standalone.

#### addToHomescreen.prompt()

Prompts the user to add the website to their home screen. Returns a promise
that resolves to a boolean indicating whether the user accepted.

```js
import { addToHomescreen } from "@jsenv/pwa";

button.onclick = async () => {
  const userAccepted = await addToHomescreen.prompt();
  console.log(userAccepted ? "added to home screen" : "declined");
};
```

> **Important**: This must be called inside a user interaction event handler
> (like click) to work properly.

#### listenAppInstalled(callback)

Calls `callback` when the app gets installed — whether the user accepted the
prompt or installed from the browser toolbar. Returns a function removing the
listener.

```js
import { listenAppInstalled } from "@jsenv/pwa";

listenAppInstalled(() => {
  console.log("app installed");
});
```

#### displayModeStandaloneRef

A reactive ref telling if the page runs in standalone display mode (launched
from the home screen).

```js
import { displayModeStandaloneRef } from "@jsenv/pwa";

displayModeStandaloneRef.subscribe((standalone) => {
  console.log(`Running in ${standalone ? "standalone" : "browser"} mode`);
});
```

## Service Worker

Service workers enable offline functionality and background updates for your
web application. `createServiceWorkerFacade` wraps registration, update
detection, update activation and messaging behind one object with reactive
state.

### Usage Example

```js
import { createServiceWorkerFacade } from "@jsenv/pwa";

const swFacade = createServiceWorkerFacade();
swFacade.setRegistrationPromise(navigator.serviceWorker.register("/sw.js"));

// Check for updates on demand (browser also checks on navigation / every 24h)
updateCheckButton.onclick = async () => {
  const found = await swFacade.checkForUpdates();
  if (!found) {
    updateStatus.textContent = "No update found";
  }
};

// React to state: show an "update" button when a new version is installed
swFacade.subscribe(() => {
  const { update } = swFacade.state;
  updateActivateButton.hidden = update.readyState !== "installed";
});
updateActivateButton.onclick = async () => {
  await swFacade.activateUpdate();
};
```

### API Reference

#### createServiceWorkerFacade({ scope, autoclaimOnFirstActivation })

Both parameters are optional. `scope` selects which registration to look up
(defaults to the whole origin). `autoclaimOnFirstActivation` makes the very
first service worker control the page as soon as it activates, instead of
waiting for the next navigation.

The returned facade exposes:

- `state` — reactive state object:

  ```js
  {
    error, // Error/ErrorEvent, null while all good
    readyState, // "" | "registering" | "installing" | "installed" | "activating" | "activated" | "redundant"
    meta, // object returned by the service worker script to the "inspect" action
    update: {
      error,
      readyState, // same values; "installed" means ready to activate
      meta,
      reloadRequired, // false when every changed resource has an update handler
    },
  }
  ```

- `subscribe(callback)` — runs the callback immediately and again whenever any
  state it reads changes; returns an unsubscribe function.
- `setRegistrationPromise(promise)` — hand it the return value of
  `navigator.serviceWorker.register(url)`.
- `checkForUpdates()` — async, resolves to `true` if an update was found.
- `activateUpdate()` — async, activates the installed update (skipWaiting +
  claim) and resolves once it controls the page.
- `sendMessage(message)` — async, posts a message to the service worker and
  resolves with its response (see [docs/usage.md](./docs/usage.md) for the
  service-worker-side snippet).
- `unregister()` — async, unregisters the service worker.
- `defineResourceUpdateHandler(url, handler)` — register how to update a
  resource in place during a service worker update instead of reloading the
  page.

After an update activates and controls the page, all client tabs reload so no
stale resource survives — unless every changed resource has a handler
registered with `defineResourceUpdateHandler`.

Messaging-based features ("inspect" meta, update diffing for
`defineResourceUpdateHandler`) expect the service worker script to answer
`{ action }` messages on a MessageChannel port —
[@jsenv/service-worker](https://github.com/jsenv/core/tree/main/packages/frontend/service-worker)
implements this protocol. With a plain service worker script everything still
works but degrades: `meta` stays empty and every update requires a page
reload.

#### navigatorControllerRef

A reactive ref exposing the service worker currently controlling the page:
`null` when not controlled, otherwise `{ meta }`.

#### pwaLogger

The package logs through `pwaLogger`, silent by default except
warnings/errors. `pwaLogger.setOptions({ logLevel: "debug" })` shows everything
the package does.
