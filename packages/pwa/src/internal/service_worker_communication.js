export const inspectServiceWorker = async (serviceWorker) => {
  let serviceWorkerResponse
  const inspectPromise = postMessageToServiceWorker(serviceWorker, {
    action: "inspect",
  }).then((info) => {
    serviceWorkerResponse = info
  })
  let timeout
  let timeoutReached = false
  const timeoutPromise = new Promise((resolve) => {
    timeout = setTimeout(() => {
      timeoutReached = true
      resolve()
    }, 1000)
  })
  await Promise.race([inspectPromise, timeoutPromise])
  clearTimeout(timeout)
  if (timeoutReached) {
    return null
  }
  return serviceWorkerResponse
}

export const requestSkipWaitingOnServiceWorker = (serviceWorker) => {
  return postMessageToServiceWorker(serviceWorker, { action: "skipWaiting" })
}

export const requestClaimOnServiceWorker = (serviceWorker) => {
  return postMessageToServiceWorker(serviceWorker, { action: "claim" })
}

// https://felixgerschau.com/how-to-communicate-with-service-workers/
export const postMessageToServiceWorker = (serviceWorker, message) => {
  const { port1, port2 } = new MessageChannel()
  return new Promise((resolve, reject) => {
    port1.onmessage = function (event) {
      if (event.data.status === "rejected") {
        reject(event.data.payload)
      } else {
        resolve(event.data.payload)
      }
    }
    serviceWorker.postMessage(message, [port2])
  })
}
