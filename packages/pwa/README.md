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
          "@jsenv/pwa": "./node_modules/@jsenv/pwa/src/main.js"
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
          "@jsenv/pwa": "./node_modules/@jsenv/pwa/src/main.js"
        }
      }
    </script>
  </head>

  <body>
    <button id="update_check_button" disabled>Check update</button>
    <p id="update_available_text"></p>
    <button id="update_activate_button" disabled>Activate update</button>
    <script type="module" src="./demo.js"></script>
  </body>
</html>
```

_demo.js_

```js
import { createServiceWorkerFacade } from "@jsenv/pwa"

const swFacade = createServiceWorkerFacade()

const registrationPromise = window.navigator.serviceWorker.register("./sw.js")
swFacade.setRegistrationPromise(registrationPromise)

const updateCheckButton = document.querySelector("#update_check_button")
updateCheckButton.disabled = false
updateCheckButton.onclick = async () => {
  const found = await swFacade.checkForUpdates()
  if (!found) {
    alert("no update found")
  }
}
const updateAvailableText = document.querySelector("#update_available_text")
const updateActivateButton = document.querySelector("#update_activate_button")
swFacade.subscribe(() => {
  const { update } = swFacade.state
  if (update) {
    updateAvailableText.innerHTML = "An update is available !"
    updateActivateButton.disabled = false
    updateActivateButton.onclick = () => {
      updateActivateButton.disabled = true
      update.activate()
    }
  } else {
    updateAvailableText.innerHTML = ""
    buttonActivateUpdate.disabled = true
  }
})
```
