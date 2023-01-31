import { writeFileSync, readFileSync } from "node:fs"
import { assert } from "@jsenv/assert"

import { setupTest } from "@jsenv/pwa/tests/setup_test.mjs"

const debug = false
const { testServer, page, browser } = await setupTest({
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  debug,
})
const swFileUrl = new URL("./client/sw.js", import.meta.url)
const swFileContent = {
  beforeTest: readFileSync(swFileUrl),
  update: (content) => writeFileSync(swFileUrl, content),
  restore: () => writeFileSync(swFileUrl, swFileContent.beforeTest),
}

try {
  await page.goto(`${testServer.origin}/main.html`)
  // there is no update
  {
    const actual = await page.evaluate(
      /* eslint-disable no-undef */
      async () => {
        const swScript = await window.SW_SCRIPT_PROMISE
        await swScript.getRegistrationPromise()
        return swScript.checkForUpdate()
      },
      /* eslint-enable no-undef */
    )
    const expected = false
    assert({ actual, expected })
  }

  // now update sw.js and expect to find this update
  {
    // updating is reloading the navigator tabs by default right
    swFileContent.update(";")
    // h
    const actual = await page.evaluate(
      /* eslint-disable no-undef */
      async () => {
        const swScript = await window.SW_SCRIPT_PROMISE
        await swScript.getRegistrationPromise()
        return swScript.checkForUpdate()
      },
      /* eslint-enable no-undef */
    )
    const expected = true
    assert({ actual, expected })
  }
} finally {
  swFileContent.restore()
  if (!debug) {
    browser.close()
  }
}
