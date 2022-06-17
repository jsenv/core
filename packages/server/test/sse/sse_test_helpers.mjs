import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

const EventSource = require("eventsource")

export const openEventSource = async (url) => {
  const eventSource = new EventSource(url, {
    https: { rejectUnauthorized: false },
  })

  const messageEvents = []

  eventSource.addEventListener(
    "message",
    ({ type, data, lastEventId, origin }) => {
      messageEvents.push({ type, data, lastEventId, origin })
    },
  )

  eventSource.getAllMessageEvents = () => messageEvents

  await new Promise((resolve, reject) => {
    eventSource.onopen = () => {
      eventSource.onerror = () => {}
      eventSource.onopen = () => {}
      resolve()
    }

    eventSource.onerror = (errorEvent) => {
      eventSource.onerror = () => {}
      if (eventSource.readyState === EventSource.CONNECTING) {
        reject(errorEvent)
      }
    }
  })

  return eventSource
}

export const closeEventSource = (eventSource) => {
  return new Promise((resolve) => {
    // eventSource.onerror = (errorEvent) => {
    //   eventSource.onerror = () => {}
    //   if (eventSource.readyState === EventSource.CLOSED) {
    //     resolve()
    //   } else {
    //     reject(errorEvent)
    //   }
    // }
    eventSource.close()
    resolve()
  })
}
