/* eslint-env serviceworker */

/*
 * We won't use this for now
 * to keep in mind: it's only when service worker is activated and controlling pages that
 * it can communicate with a page by itself, in other words service worker cannot send early errors
 * (occuring during install or activate phase)
 * to the page
 * Moreover browser devtools already show these errors there is no strong need to
 * mirror them in the API
 */

error_reporting_to_clients: {
  const postMessageToClients = async (message) => {
    const matchingClients = await self.clients.matchAll()
    matchingClients.forEach((matchingClient) => {
      matchingClient.postMessage(message)
    })
  }
  const errorAsTransferable = (error) => {
    const errorAsObject = {
      name: Object.getPrototypeOf(error).name,
      message: error.message,
      stack: error.stack || new Error().stack,
    }
    return errorAsObject
  }
  self.addEventListener("error", (event) => {
    postMessageToClients({
      action: "report_error",
      payload: errorAsTransferable(event.error),
    })
  })
  self.addEventListener("unhandledrejection", ({ reason, detail }) => {
    if (!reason && detail) {
      reason = detail.reason
    }
    if (reason && reason.stack && reason.message) {
      postMessageToClients({
        action: "report_unhandled_rejection",
        payload: errorAsTransferable(reason),
      })
    } else {
      postMessageToClients({
        action: "report_unhandled_rejection",
        payload: reason,
      })
    }
  })
}

/*
// code above is meant to be listened in the main page
// with the following code
serviceWorkerAPI.addEventListener("message", (event) => {
  if (
    event.source === fromServiceWorker &&
    event.data &&
    typeof event.data === "object"
  ) {
    if (event.data.action === "report_error") {
      mutate({
        error: new Error(
          `Error reported by service worker script: ${event.data.payload.message}`,
        ),
      })
    }
    if (event.data.action === "report_unhandled_rejection") {
      mutate({
        error: new Error(
          `Unhandled rejection reported by service worker script: ${event.data.payload}`,
        ),
      })
    }
  }
})
*/
