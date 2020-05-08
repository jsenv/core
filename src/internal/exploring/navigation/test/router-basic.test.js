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
const router = createRouter(
  ({ destinationUrl }) => {
    if (destinationUrl === initialUrl) {
      return "initial"
    }
    const pathname = new URL(destinationUrl).pathname
    if (pathname === "/A") {
      return "A"
    }
    return "B"
  },
  {
    onstart: ({ destinationUrl, cancel }) => {
      if (new URL(destinationUrl).pathname === "/B") {
        cancel()
      }
    },
    oncomplete: (navigation, { page }) => {
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
  },
)

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
