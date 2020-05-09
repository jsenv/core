/*

This test verifies that a navigation to initial page works.
Then that navigating to page A works.
Then that navigating to page B can be canceled and that doing history.back goes to initial page.

*/

import { assert } from "@jsenv/assert"
import { createRouter } from "../router.js"

let firsPageAVisit = true
let resolveActual
const pagePromise = new Promise((resolve) => {
  resolveActual = resolve
})
const initialUrl = document.location.href
const initialRoute = {
  match: (url) => url === initialUrl,
  load: () => "initial",
}
const ARoute = { match: (url) => new URL(url).pathname === "/A", load: () => "A" }
const BRoute = {
  match: (url) => new URL(url).pathname === "/B",
  load: () => "B",
}
const router = createRouter([initialRoute, ARoute, BRoute], {
  onstart: ({ route, cancel }) => {
    if (route === BRoute) {
      cancel()
    }
  },
  oncomplete: ({ page }) => {
    if (page === "initial") {
      router.navigateToUrl("/A")
    }
    if (page === "A") {
      if (firsPageAVisit) {
        firsPageAVisit = false
        router.navigateToUrl("/B")
      } else {
        resolveActual(page)
      }
    }
  },
})

router.launchCurrentUrl()

const actual = {
  page: await pagePromise,
  url: document.location.href,
}
const expected = {
  page: "initial",
  url: initialUrl,
}
assert({ actual, expected })
