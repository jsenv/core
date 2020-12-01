/**

Le but du service worker c'est que si on reload la page
il prenne le controle du bordel (ça puisse fonctionner offline)

*/

const canUseServiceWorker = Boolean(window.navigator.serviceWorker)

export const registerServiceWorker = async (
  url,
  { scope, onstatechange = () => {}, onupdate = () => {} } = {},
) => {
  if (!canUseServiceWorker) {
    return () => {}
  }

  const navigatorServiceWorker = window.navigator.serviceWorker

  const installStateChangeCallback = (serviceWorker) => {
    onstatechange(serviceWorker.state, serviceWorker)
    serviceWorker.onstatechange = () => {
      onstatechange(serviceWorker.state, serviceWorker)
    }
  }

  const serviceWorkerControllingPage = getServiceWorkerControllingPage()

  try {
    const registration = await navigatorServiceWorker.register(url, { scope })
    const { installing, waiting, active } = registration

    if (serviceWorkerControllingPage) {
      installStateChangeCallback(serviceWorkerControllingPage)
      // ben si on est en mode installing c'est un update found
      // sinon on se fout des update found de toute facon
      registration.addEventListener("updatefound", () => {
        const nextWorker = registration.installing
        nextWorker.onstatechange = () => {
          if (nextWorker.state === "installed") {
            onupdate({
              skipWaiting: () => {
                sendMessageUsingChannel({ action: "skipWaiting" }, nextWorker)
              },
            })
          }
          if (nextWorker.state === "activating") {
            // ce nouveau worker devient le worker actif
            // l'ancien worker est redundant
            installStateChangeCallback(nextWorker)
          }
        }
      })
    } else if (installing) {
      installStateChangeCallback(installing)
    } else if (waiting) {
      installStateChangeCallback(waiting)
    } else if (active) {
      installStateChangeCallback(active)
    }

    return () => {
      registration.unregister()
    }
  } catch (e) {
    console.warn("ServiceWorker registration failed: ", e)
    return () => {}
  }
}

export const observeServiceWorkerController = (callback) => {
  if (!canUseServiceWorker) return () => {}

  const navigatorServiceWorker = window.navigator.serviceWorker

  const checkController = () => {
    callback(navigatorServiceWorker.controller)
  }

  checkController()
  // This fires when the service worker controlling this page
  // changes, eg a new worker has skipped waiting and become
  // the new active worker.
  navigatorServiceWorker.addEventListener("controllerchange", checkController)
  return () => {
    navigatorServiceWorker.removeEventListener("controllerchange", checkController)
  }
}

export const sendMessageToServiceWorkerControllingPage = async (message) => {
  const serviceWorkerControllingPage = getServiceWorkerControllingPage()
  if (!serviceWorkerControllingPage) {
    return undefined
  }
  return sendMessageUsingChannel(message, serviceWorkerControllingPage)
}

export const checkServiceWorkerUpdate = async () => {
  if (!pageIsControlledByServiceWorker()) {
    return false
  }
  const registration = await window.navigator.serviceWorker.ready
  const updateRegistration = await registration.update()

  const { installing, waiting } = updateRegistration
  if (!installing && !waiting) return false

  return true
}

const pageIsControlledByServiceWorker = () => {
  return Boolean(getServiceWorkerControllingPage())
}

const getServiceWorkerControllingPage = () => {
  return canUseServiceWorker ? window.navigator.serviceWorker.controller : null
}

// https://felixgerschau.com/how-to-communicate-with-service-workers/
const sendMessageUsingChannel = (message, objectWithPostMessage) => {
  const { port1, port2 } = new MessageChannel()
  return new Promise((resolve, reject) => {
    port1.onmessage = function (event) {
      if (event.data.status === "rejected") {
        reject(event.data.value)
      } else {
        resolve(event.data.value)
      }
    }
    objectWithPostMessage.postMessage(message, [port2])
  })
}
