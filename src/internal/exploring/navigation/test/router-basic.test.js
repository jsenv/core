/*

This test verifies that a navigation to initial page works.
Then that navigating to page A works.
Then that navigating to page B can be canceled and that doing history.back goes to initial page.

TODO: rewrite this for application history

*/

import { assert } from "@jsenv/assert"
import { createApplicationHistory } from "../application-history.js"

let firsPageAVisit = true
let resolveNavigation
const navigationPromise = new Promise((resolve) => {
  resolveNavigation = resolve
})
const initialUrl = document.location.href
const initialRoute = {
  match: ({ url }) => url === initialUrl,
  activate: () => "initial",
}
const ARoute = {
  match: ({ url }) => new URL(url).pathname === "/A",
  activate: () => "A",
}
const BRoute = {
  match: ({ url }) => new URL(url).pathname === "/B",
  activate: () => "B",
}
const appHistory = createApplicationHistory([initialRoute, ARoute, BRoute], {
  onstart: ({ route, cancel }) => {
    if (route === BRoute) {
      cancel()
      setTimeout(resolveNavigation, 100)
    }
  },
  oncomplete: ({ page }) => {
    if (page === "initial") {
      appHistory.pushState(null, "/A")
    }
    if (page === "A") {
      if (firsPageAVisit) {
        firsPageAVisit = false
        appHistory.pushState(null, "/B")
      }
    }
  },
})

appHistory.replaceState()

await navigationPromise
const actual = document.location.href
const expected = new URL("/A", document.location).href
assert({ actual, expected })
