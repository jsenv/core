import { chromium } from "playwright"
import { assert } from "@jsenv/assert"

import { startServer, createSSERoom, fetchFileSystem } from "@jsenv/server"

const room = createSSERoom({
  // logLevel: "debug",
  maxClientAllowed: 1,
})
const server = await startServer({
  logLevel: "warn",
  keepProcessAlive: false,
  requestToResponse: (request) => {
    const { accept = "" } = request.headers
    if (accept.includes("text/event-stream")) {
      return room.join(request)
    }

    return fetchFileSystem(new URL("./main.html", import.meta.url))
  },
})

const browser = await chromium.launch({
  args: [],
})
const browserContext = await browser.newContext({ ignoreHTTPSErrors: true })
const page = await browserContext.newPage()

await page.goto(server.origin)

await page.evaluate((serverOrigin) => {
  // eslint-disable-next-line no-undef
  const eventSource = new EventSource(serverOrigin, {
    withCredentials: true,
  })
  return new Promise((resolve, reject) => {
    eventSource.onopen = () => {
      resolve()
    }
    eventSource.onerror = (errorEvent) => {
      reject(errorEvent)
    }
  })
}, server.origin)

{
  const actual = room.getRoomClientCount()
  const expected = 1
  assert({
    actual,
    expected,
  })
}

await page.evaluate(() => {
  // eslint-disable-next-line no-undef
  window.location.reload(true)
})

{
  const actual = room.getRoomClientCount()
  const expected = 0
  assert({
    actual,
    expected,
  })
}

browser.close()
