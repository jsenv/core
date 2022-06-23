import { assert } from "@jsenv/assert"
import { fetchUrl } from "@jsenv/fetch"

import { startServer, pluginServerTiming, timeFunction } from "@jsenv/server"
import { parseServerTimingHeader } from "@jsenv/server/src/server_timing/timing_header.js"

const { origin } = await startServer({
  plugins: {
    ...pluginServerTiming(),
  },
  keepProcessAlive: false,
  logLevel: "warn",
  requestToResponse: async () => {
    const [waitTiming] = await timeFunction("waiting 50ms", async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 50)
      })
    })

    return {
      status: 200,
      timing: waitTiming,
    }
  },
})

{
  const response = await fetchUrl(origin)
  const actual = parseServerTimingHeader(response.headers.get("server-timing"))
  const expected = {
    a: {
      description: "waiting 50ms",
      duration: actual.a.duration,
    },
    b: {
      description: "time to start responding",
      duration: actual.b.duration,
    },
  }
  assert({ actual, expected })
}
