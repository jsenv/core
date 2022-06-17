// https://www.w3.org/TR/server-timing/

import { performance } from "node:perf_hooks"

import { timingToServerTimingResponseHeaders } from "./timing_header.js"

export const pluginServerTiming = () => {
  return {
    server_timing: {
      onRequest: () => {
        const requestStartEvent = performance.now()
        return {
          onResponse: (response) => {
            const responseEndEvent = performance.now()
            const timeToCreateResponse = responseEndEvent - requestStartEvent
            const serverTiming = {
              ...response.timing,
              "time to start responding": timeToCreateResponse,
            }
            return {
              headers: timingToServerTimingResponseHeaders(serverTiming),
            }
          },
        }
      },
    },
  }
}
