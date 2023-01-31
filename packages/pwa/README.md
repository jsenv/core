# pwa [![npm package](https://img.shields.io/npm/v/@jsenv/pwa.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/pwa)

_@jsenv/pwa_ is a tool that can be used to implement the apis required to turn a website into a progressive web application:

- Add to home screen
- Service workers

# Add to home screen

User can choose to add a shortcut to your website in their device.
The navigator will then run your website with only your ui in fullscreen.

The following html displays a button enabled when add to home screen is available. Clicking on the button prompt user to add the website to home screen.

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="icon" href="data:," />
    <script type="importmap">
      {
        "imports": {
          "@jsenv/pwa": "./node_modules/@jsenv/pwa/main.js"
        }
      }
    </script>
  </head>

  <body>
    <button id="add-to-home-screen" disabled>Add to home screen</button>
    <script type="module">
      import { addToHomescreen } from "@jsenv/pwa"

      const button = document.querySelector("button#add-to-home-screen")

      button.disabled = !addToHomescreen.isAvailable()
      addToHomescreen.listenAvailabilityChange(() => {
        document.querySelector("button#add-to-home-screen").disabled =
          !addToHomescreen.isAvailable()
      })
      button.onclick = () => {
        addToHomescreen.prompt()
      }
    </script>
    <!--
    "beforeinstallprompt" event might be dispatched very quickly by the navigator, before
    <script type="module"> above got a chance to catch it. For this reason, we listen
    early for this event and store it into window.beforeinstallpromptEvent.
    When "@jsenv/pwa" is imported it will check window.beforeinstallpromptEvent existence.
    -->
    <script>
      window.addEventListener(
        "beforeinstallprompt",
        (beforeinstallpromptEvent) => {
          beforeinstallpromptEvent.preventDefault()
          window.beforeinstallpromptEvent = beforeinstallpromptEvent
        },
      )
    </script>
  </body>
</html>
```

## addToHomescreen.isAvailable

_addToHomescreen.isAvailable_ is a function returning a boolean indicating if addToHomescreen is available. This function must be used to know if you can call [addToHomescreen.prompt](#addToHomescreenprompt).

Add to home screen is available if navigator fired a _beforeinstallprompt_ event

## addToHomescreen.listenAvailabilityChange

_addToHomescreen.listenAvailabilityChange_ is a function that will call a callback when add to home screen becomes available or unavailable.

## addToHomescreen.prompt

_addToHomescreen.prompt_ is an async function that will ask navigator to trigger a prompt to ask user if he wants to add your website to their homescreen. It resolves to a boolean indicating if users accepted or declined the prompt.

It can be called many times but always inside a user interaction event handler, such as a click event.

## displayModeStandalone

_displayModeStandalone_ is an object that can be used to know if display mode is standalone or be notified when this changes. The standalone display mode is true when your web page is runned as an application (navigator ui is mostly/fully hidden).

```js
import { displayModeStandalone } from "@jsenv/pwa"

displayModeStandalone.get() // true or false

displayModeStandalone.listen(() => {
  displayModeStandalone.get() // true or false
})
```

# Service worker

Service worker allows you to register a script in the navigator. That script is granted with the ability to communicate with browser internal cache and intercept any request made by the navigator. They are designed to make a website capable to work offline and load instantly from cache before wondering if there is any update available. Read more on [MDN documentation about service worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).

The raw service worker api offered by navigators is complex to implement. Especially when it comes to updating a service worker. This section shows how to use `@jsenv/pwa` to register and update a service worker.

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="icon" href="data:," />
    <script type="importmap">
      {
        "imports": {
          "@jsenv/pwa": "./node_modules/@jsenv/pwa/main.js"
        }
      }
    </script>
  </head>

  <body>
    <button id="check-update" disabled>Check update</button>
    <p id="update-available"></p>
    <button id="activate-update" disabled>Activate update</button>
    <script type="module" src="./demo.js"></script>
  </body>
</html>
```

```js
// ./demo.js
import { canUseServiceWorkers, createServiceWorkerScript } from "@jsenv/pwa"

if (canUseServiceWorkers) {
  const script = createServiceWorkerScript()
  const registrationPromise = window.navigator.serviceWorker.register("./sw.js")
  script.setRegistrationPromise(registrationPromise)

  const buttonCheckUpdate = document.querySelector("#check-update")
  buttonCheckUpdate.disabled = false
  buttonCheckUpdate.onclick = async () => {
    const found = await script.checkForUpdate()
    if (!found) {
      alert("no update found")
    }
  }
  const textUpdateAvailable = document.querySelector("#update-available")
  const buttonActivateUpdate = document.querySelector("#activate-update")
  script.listenUpdateChange(() => {
    const update = script.getUpdate()
    if (update) {
      textUpdateAvailable.innerHTML = "An update is available !"
      buttonActivateUpdate.disabled = false
      buttonActivateUpdate.onclick = () => {
        buttonActivateUpdate.disabled = true
        update.activate()
      }
    } else {
      textUpdateAvailable.innerHTML = ""
      buttonActivateUpdate.disabled = true
    }
  })
}
```

See also an example with react in [docs/react_example](./packages/react_example/react_sw_example.jsx).

## Service worker registration

```js
import { createServiceWorkerScript } from "@jsenv/pwa"

const script = createServiceWorkerScript()
script.setRegistrationPromise(
  window.navigator.serviceWorker.register("./sw.js"),
)
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
await script.setRegistrationPromise(
  window.navigator.serviceWorker.register("./sw.js"),
)
const value = await script.sendMessage("ping")
console.log(value) // "pong"
```

You can use _sendMessage_ while service worker is installing, activating or activated. When a new version of the service worker scripts starts to activate, _sendMessage_ communicates with it and it's no longer possible to communicate with the old version.

## Service worker update

The native browser API around service worker update is hard to implement. There is an article illustrating the issues at https://redfin.engineering/how-to-fix-the-refresh-button-when-using-service-workers-a8e27af6df68.

`@jsenv/pwa` helps to implement your user interface around service worker updates.

### checkForUpdate

An async function asking to the navigator to check if there is an update available for the service worker. It returns true if there is one and false otherwise.

```js
import { createServiceWorkerScript } from "@jsenv/pwa"

const script = createServiceWorkerScript()
script.setRegistrationPromise(
  window.navigator.serviceWorker.register("./sw.js"),
)
const updateFound = await script.checkForUpdate()
console.log(updateFound)
```

### listenUpdateChange

_listenUpdateChange_ is a function that will call a callback when a service worker update becomes available or unavailable. An update is always detected by the navigator either periodically or because your called _checkForUpdate_.

```js
import { createServiceWorkerScript } from "@jsenv/pwa"

const script = createServiceWorkerScript()
script.listenUpdateChange(() => {
  // an update for this service worker script becomes available
  // or unavailable (the new version is installed or discarded)
})
```

### getUpdate

_getUpdate_ is a function returning a value indicating if there is an update available.

```js
import { createServiceWorkerScript } from "@jsenv/pwa"

const script = createServiceWorkerScript()
const update = serviceWorker.getUpdate()
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

_navigatorWillReload_ is true if auto reload feature is enabled. Auto reload is documented in [autoReloadAfterUpdate](#autoReloadAfterUpdate).

### update.sendMessage

An async function that can be used to communicate with a service worker while it's installing, installed (waiting to activate) or activating. After that you must [sendMessage](#sendMessage); If you don't `update.sendMessage` would log a warning and returns `undefined`.

#### update.activate

After a new service worker is installed, navigator is waiting every tab using the old service worker to be closed. When all tabs are closed navigator kills the old service worker and activates the new one.

_update.activate_ is an async function telling navigator it can skip waiting and kill the old service worker immediatly. If the navigator was controlled, this new service worker will become the navigator controller.

```js
import { createServiceWorkerScript } from "@jsenv/pwa"

const script = createServiceWorkerScript()
script.listenUpdateChange(() => {
  const update = script.getUpdate()
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

When a service worker updates, navigator might be using outdated ressources such as old images or old js files.
When a new service worker becomes the worker controlling navigator, we must ensure outdated ressources are refreshed.
The default behaviour is to reload all navigator tabs opened on your website to make them go through the new service worker.
It is described as _"Approach #3"_ in [How to Fix the Refresh Button When Using Service Workers](https://redfin.engineering/how-to-fix-the-refresh-button-when-using-service-workers-a8e27af6df68). You might also want to check [Activate updated service worker on refresh](https://stackoverflow.com/questions/40100922/activate-updated-service-worker-on-refresh) on StackOverflow.

If you want to control how the outdated ressources gets updated you can disable this behaviour using _autoReloadAfterUpdate_. This might happen when:

- You want to control when and if tabs are reloaded
- You want to let user control when tabs are reloaded. Maybe display a message like "Update done. Reload all active tabs to enable the new version"

```js
import { createServiceWorkerScript } from "@jsenv/pwa"

const script = createServiceWorkerScript({ autoReloadAfterUpdate: false })
```
