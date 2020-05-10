/*

This test verifies that a navigation to initial page works.
Then that navigating to page A works.
Then that navigating to page B can be canceled and that doing history.back goes to initial page.

*/

import { assert } from "@jsenv/assert"
import { createRouter } from "../router.js"

let firsPageAVisit = true
let resolveNavigation
const navigationPromise = new Promise((resolve) => {
  resolveNavigation = resolve
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
      setTimeout(resolveNavigation, 100)
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
      }
    }
  },
})

router.loadCurrentUrl()

await navigationPromise
const actual = document.location.href
const expected = new URL("/A", document.location).href
assert({ actual, expected })
