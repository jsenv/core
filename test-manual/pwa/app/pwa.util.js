export const createServiceWorker = (
  url,
  {
    // This fires when the service worker controlling this page
    // changes, eg a new worker has skipped waiting and become
    // the new active worker.
    oncontrollerchanged = () => {},
  } = {},
) => {
  const scriptURL = String(new URL(url, document.location.href))

  const { navigator } = window
  const navigatorServiceWorker = navigator.serviceWorker
  if (!navigatorServiceWorker) {
    return {
      checkForUpdate: async () => {
        return { found: false }
      },
    }
  }

  const isActive = () => {
    return Boolean(navigatorServiceWorker.controller)
  }

  let statechangeCallback = () => {}

  const installStateChangeCallback = (serviceWorker) => {
    if (serviceWorker.onstatechange) {
      throw new Error(`already installed`)
    }
    serviceWorker.onstatechange = () => {
      statechangeCallback(serviceWorker.state, serviceWorker)
    }
    statechangeCallback(serviceWorker.state, serviceWorker)
  }

  const observeState = async (callback) => {
    statechangeCallback = callback

    const activeServiceWorker = navigatorServiceWorker.controller
    if (activeServiceWorker && activeServiceWorker.scriptURL === scriptURL) {
      installStateChangeCallback(activeServiceWorker)
    }
  }

  const checkForUpdate = async () => {
    if (!isActive()) {
      return { found: false }
    }

    const registration = await navigatorServiceWorker.ready
    if (!registration.waiting && !registration.installing) {
      return { found: false }
    }
    return { found: true }
  }

  const unregister = async () => {
    if (!isActive()) {
      return false
    }
    const registration = await navigatorServiceWorker.ready
    const result = await registration.unregister()
    return result
  }

  navigatorServiceWorker.addEventListener("controllerchange", () => {
    oncontrollerchanged()
  })

  let registerDone = false
  const register = async () => {
    if (registerDone) return
    try {
      const serviceWorkerRegistration = await navigatorServiceWorker.register(url)

      const { installing, installed, active } = serviceWorkerRegistration
      console.log({
        installing: serviceWorkerRegistration.installing,
        installed: serviceWorkerRegistration.installed,
        active: serviceWorkerRegistration.active,
      })

      if (installing) {
        // we will be notified by update found
      } else if (installed) {
        installStateChangeCallback(installed)
      } else if (active) {
        if (navigatorServiceWorker.controller) {
          // we already know about this service worker
        } else {
          installStateChangeCallback(active)
        }
      }
      serviceWorkerRegistration.addEventListener("updatefound", () => {
        installStateChangeCallback(serviceWorkerRegistration.installing)
      })
      registerDone = true
    } catch (e) {
      console.warn("ServiceWorker registration failed: ", e)
    }
  }

  return { observeState, isActive, register, checkForUpdate, unregister }
}
