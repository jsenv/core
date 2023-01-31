import { assert } from "@jsenv/assert"

import { setupTest } from "@jsenv/pwa/tests/setup_test.mjs"

const debug = false
const { testServer, page, browser } = await setupTest({
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  debug,
})
try {
  await page.goto(`${testServer.origin}/main.html`)
  const actual = await page.evaluate(
    /* eslint-disable no-undef */
    () => window.resultPromise,
    /* eslint-enable no-undef */
  )
  const expected = "pong"
  assert({ actual, expected })
} finally {
  if (!debug) {
    browser.close()
  }
}
