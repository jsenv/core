# @jsenv/pwa [![npm package](https://img.shields.io/npm/v/@jsenv/pwa.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/pwa)

A toolkit to implement progressive web application (PWA) features in your website.

🏠 Add to home screen functionality  
🔄 Service worker lifecycle management  
📱 Display mode detection  
🛠️ Simple APIs for complex PWA features

## Table of Contents

- [@jsenv/pwa ](#jsenvpwa-)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
  - [Add to Home Screen](#add-to-home-screen)
    - [Usage Example](#usage-example)
    - [API Reference](#api-reference)
      - [addToHomescreen.isAvailable()](#addtohomescreenisavailable)
      - [addToHomescreen.listenAvailabilityChange(callback)](#addtohomescreenlistenavailabilitychangecallback)
      - [addToHomescreen.prompt()](#addtohomescreenprompt)
      - [displayModeStandalone](#displaymodestandalone)
  - [Service Worker](#service-worker)
    - [Usage Example](#usage-example-1)
    - [API Reference](#api-reference-1)
      - [createServiceWorkerFacade()](#createserviceworkerfacade)

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

    <!-- Listen early for beforeinstallprompt event -->
    <script>
      window.addEventListener(
        "beforeinstallprompt",
        (beforeinstallpromptEvent) => {
          beforeinstallpromptEvent.preventDefault();
          window.beforeinstallpromptEvent = beforeinstallpromptEvent;
        },
      );
    </script>

    <!-- Handle add to homescreen functionality -->
    <script type="module">
      import { addToHomescreen } from "@jsenv/pwa";

      const button = document.querySelector("#add-to-home-screen");

      // Initial state
      button.disabled = !addToHomescreen.isAvailable();

      // Update when availability changes
      addToHomescreen.listenAvailabilityChange(() => {
        button.disabled = !addToHomescreen.isAvailable();
      });

      // Show prompt when clicked
      button.onclick = async () => {
        const accepted = await addToHomescreen.prompt();
        console.log(accepted ? "User accepted" : "User declined");
      };
    </script>
  </body>
</html>
```

### API Reference

#### addToHomescreen.isAvailable()

Returns a boolean indicating if the "Add to Home Screen" feature is available.

```js
import { addToHomescreen } from "@jsenv/pwa";

if (addToHomescreen.isAvailable()) {
  // Enable "Add to Home Screen" button
}
```

The feature is available when the browser has fired a `beforeinstallprompt` event.

#### addToHomescreen.listenAvailabilityChange(callback)

Registers a callback that will be called whenever the availability of "Add to Home Screen" changes.

```js
import { addToHomescreen } from "@jsenv/pwa";

addToHomescreen.listenAvailabilityChange(() => {
  const isAvailable = addToHomescreen.isAvailable();
  console.log(
    `Add to homescreen is now ${isAvailable ? "available" : "unavailable"}`,
  );
});
```

#### addToHomescreen.prompt()

Prompts the user to add the website to their home screen. Returns a promise that resolves to a boolean indicating whether the user accepted.

```js
import { addToHomescreen } from "@jsenv/pwa";

button.onclick = async () => {
  if (!addToHomescreen.isAvailable()) {
    return;
  }

  const userAccepted = await addToHomescreen.prompt();
  if (userAccepted) {
    console.log("User added the app to home screen");
  } else {
    console.log("User declined the add to home screen prompt");
  }
};
```

> **Important**: This must be called inside a user interaction event handler (like click) to work properly.

#### displayModeStandalone

An object to detect if the website is running in standalone mode (added to home screen).

```js
import { displayModeStandalone } from "@jsenv/pwa";

// Check current mode
const isStandalone = displayModeStandalone.get();
console.log(`Running in ${isStandalone ? "standalone" : "browser"} mode`);

// Listen for mode changes
displayModeStandalone.listen(() => {
  if (displayModeStandalone.get()) {
    console.log("App is now running in standalone mode");
  } else {
    console.log("App is now running in browser mode");
  }
});
```

## Service Worker

Service workers enable offline functionality and background updates for your web application.

### Usage Example

```html
<!doctype html>
<html>
  <head>
    <title>Service Worker Demo</title>
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
    <button id="update-check-button" disabled>Check for updates</button>
    <p id="update-status"></p>
    <button id="update-activate-button" disabled>Activate update</button>

    <script type="module">
      import { createServiceWorkerFacade } from "@jsenv/pwa";

      // Create service worker facade
      const swFacade = createServiceWorkerFacade();

      // Register service worker
      const registration = navigator.serviceWorker.register("./sw.js");
      swFacade.setRegistrationPromise(registration);

      // UI elements
      const updateCheckButton = document.getElementById("update-check-button");
      const updateStatus = document.getElementById("update-status");
      const updateActivateButton = document.getElementById(
        "update-activate-button",
      );

      // Enable update checking
      updateCheckButton.disabled = false;
      updateCheckButton.onclick = async () => {
        updateStatus.textContent = "Checking for updates...";
        const found = await swFacade.checkForUpdates();
        if (!found) {
          updateStatus.textContent = "No updates found";
        }
      };

      // Subscribe to state changes
      swFacade.subscribe(() => {
        const { update } = swFacade.state;
        if (update) {
          updateStatus.textContent = "Update available!";
          updateActivateButton.disabled = false;
          updateActivateButton.onclick = () => {
            updateActivateButton.disabled = true;
            update.activate();
          };
        } else {
          updateStatus.textContent = "";
          updateActivateButton.disabled = true;
        }
      });
    </script>
  </body>
</html>
```

### API Reference

#### createServiceWorkerFacade()
