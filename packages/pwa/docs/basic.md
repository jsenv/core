!! OUTDATED !!

## Service worker registration

```js
import { createServiceWorkerScript } from "@jsenv/pwa"

const script = createServiceWorkerScript()
script.setRegisterPromise(window.navigator.serviceWorker.register("./sw.js"))
```

This enables service worker on your navigator.
And the navigator will take care of checking if your service worker has changed and update it.
Navigator check updates every time page is loaded or every 24h. If there is an update, navigator activate the new service worker only once every tab using the previous version are closed. Refreshing a tab is not enough.

## Service worker communication

_sendMessage_ can be used to send a message to your service worker and get the response back.

_Inside service_worker.js:_

```js
self.addEventListener("message", async ({ data, ports }) => {
  if (data === "ping") {
    ports[0].postMessage({ status: "resolved", value: "pong" })
  }
})
```

_Inside your website:_

```js
import { createServiceWorkerScript } from "@jsenv/pwa"

const script = createServiceWorkerScript()
await script.setRegisterPromise(
  window.navigator.serviceWorker.register("./sw.js"),
)
const value = await script.sendMessage("ping")
console.log(value) // "pong"
```

You can use _sendMessage_ while service worker is installing, activating or activated. When a new version of the service worker scripts starts to activate, _sendMessage_ communicates with it and it's no longer possible to communicate with the old version.
