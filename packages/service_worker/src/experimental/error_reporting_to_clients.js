/* eslint-env serviceworker */

/*
 * We won't use this for now
 */

error_reporting_to_clients: {
  const postMessageToClients = async (message) => {
    const matchingClients = await self.clients.matchAll()
    matchingClients.forEach((matchingClient) => {
      matchingClient.postMessage(message)
    })
  }
  const postErrorToClients = (error) => {
    const errorAsObject = {
      name: Object.getPrototypeOf(error).name,
      message: error.message,
      stack: error.stack || new Error().stack,
    }
    return postMessageToClients({
      action: "error",
      payload: errorAsObject,
    })
  }
  self.addEventListener("error", (event) => {
    postErrorToClients(event.error)
  })
  self.addEventListener("unhandledrejection", ({ reason, detail }) => {
    if (!reason && detail) {
      reason = detail.reason
    }
    if (reason === null || reason === undefined) {
      postErrorToClients({
        message: "unhandled rejection reason was null or undefined",
      })
    } else if (typeof reason === "object") {
      postErrorToClients(reason)
    } else {
      postErrorToClients({
        message: reason,
      })
    }
  })
}
