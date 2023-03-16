!! OUTDATED !!

## Service worker update

The native browser API around service worker update is hard to implement. There is an article illustrating the issues at https://redfin.engineering/how-to-fix-the-refresh-button-when-using-service-workers-a8e27af6df68.

`@jsenv/pwa` helps to implement your user interface around service worker updates.

### checkForUpdates

An async function asking to the navigator to check if there is an update available for the service worker. It returns true if there is one and false otherwise.

```js
import { createServiceWorkerScript } from "@jsenv/pwa"

const script = createServiceWorkerScript()
script.setRegisterPromise(window.navigator.serviceWorker.register("./sw.js"))
const updateFound = await script.checkForUpdates()
console.log(updateFound)
```

### addUpdateCallback

_addUpdateCallback_ is a function that will call a callback when a service worker update becomes available or unavailable. An update is always detected by the navigator either periodically or because your called _checkForUpdates_.

```js
import { createServiceWorkerScript } from "@jsenv/pwa"

const script = createServiceWorkerScript()
script.addUpdateCallback((update) => {
  // an update for this service worker script becomes available
  // or unavailable (the new version is installed or discarded)
})
```

_update_ is `null` if there is no update available. Otherwise it is an object like

```js
{
  shouldBecomeNavigatorController, // Boolean
  navigatorWillReload, // Boolean
  sendMessage, // Function
  activate, // Function
}
```

### update.sendMessage

An async function that can be used to communicate with a service worker while it's installing, installed (waiting to activate) or activating. After that you must [sendMessage](#sendMessage); If you don't `update.sendMessage` would log a warning and returns `undefined`.

#### update.activate

After a new service worker is installed, navigator is waiting every tab using the old service worker to be closed. When all tabs are closed navigator kills the old service worker and activates the new one.

_update.activate_ is an async function telling navigator it can skip waiting and kill the old service worker immediatly. If the navigator was controlled, this new service worker will become the navigator controller.

```js
import { createServiceWorkerScript } from "@jsenv/pwa"

const script = createServiceWorkerScript()
script.addUpdateCallback((update) => {
  if (update) {
    await update.activate({
      onActivating: () => {
        // new service worker is activating
      },
      onActivated: () => {
        // new service worker is activated
      },
      onBecomesNavigatorController: () => {
        // This callback is called only if the service worker
        // is controlling the navigator once activated
      },
    })
  }
})
```

Once service worker is activated, update is considered as done which will certainly trigger [Auto reload after update](#Auto-reload-after-update).

## Auto reload after update

When a new service worker becomes the worker controlling navigator it is mandatory to ensure any outdated resource is refreshed. For this reason, after an update all navigator tabs opened on the website are reloaded. This default behaviour ensure navigator go through the new service worker.
It is described as _"Approach #3"_ in [How to Fix the Refresh Button When Using Service Workers](https://redfin.engineering/how-to-fix-the-refresh-button-when-using-service-workers-a8e27af6df68). It is also discussed in [Activate updated service worker on refresh](https://stackoverflow.com/questions/40100922/activate-updated-service-worker-on-refresh) on StackOverflow.

It is possible to to control how the outdated resources gets updated using _autoReloadAfterUpdate_. This might happen when:

- You want to control when and if tabs are reloaded
- You want to let user control when tabs are reloaded. Maybe display a message like "Update done. Reload all active tabs to enable the new version"

```js
import { createServiceWorkerScript } from "@jsenv/pwa"

const script = createServiceWorkerScript({ autoReloadAfterUpdate: false })
```
