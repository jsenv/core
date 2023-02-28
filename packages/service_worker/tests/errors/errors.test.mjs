/*
 * when there is an error during install/activate
 * the service worker is still registered and cannot be unregistered by API
 * test that is we rebuild a correct service worker (one that does not throw)
 * the registration happens somehow and everything works fine
 * test this also when the update fails to install/activate
 */

import { writeFileSync } from "node:fs"
import { chromium } from "playwright"
import { ensureEmptyDirectory } from "@jsenv/filesystem"
import { createTaskLog } from "@jsenv/log"
import { buildServer } from "./error_build_server.mjs"

await ensureEmptyDirectory(new URL("./screenshots/", import.meta.url))
const debug = false
const browser = await chromium.launch({ headless: !debug })
const context = await browser.newContext()
const openPage = async (url) => {
  const page = await context.newPage({ ignoreHTTPSErrors: true })
  await page.setViewportSize({ width: 640, height: 480 }) // set a relatively small and predicatble size
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.error(message.text())
    }
  })
  await page.goto(url)
  return page
}
const clickToBuildStory = async (page, name) => {
  const buildButton = await page.locator(`button#build_${name}`)
  await buildButton.click()
  await new Promise((resolve) => setTimeout(resolve, 1_000))
}
const clickToCheckUpdate = async (page) => {
  const updateCheckButton = await page.locator("button#update_check_button")
  await updateCheckButton.click()
}
const waitForPageReady = async (page) => {
  const pageReadyPromise = page.evaluate(
    /* eslint-disable no-undef */
    () => window.readyPromise,
    /* eslint-enable no-undef */
  )
  await pageReadyPromise
}
let screenshotCount = 0
const takeScreenshot = async (page, name) => {
  name = `${screenshotCount}_${name}`
  screenshotCount++
  const task = createTaskLog(`screenshot ${name} on chromium`, {
    disabled: process.env.FROM_TESTS,
  })
  const sceenshotBuffer = await page.locator("#ui").screenshot()
  writeFileSync(
    new URL(`./screenshots/${name}`, import.meta.url),
    sceenshotBuffer,
  )
  task.done()
}

try {
  const htmlUrl = `${buildServer.origin}/main.html`
  const page = await openPage(htmlUrl)

  await waitForPageReady(page)
  await takeScreenshot(page, "after_load.png")
  // error during first register
  await clickToBuildStory(page, "error_during_register")
  {
    const registerButton = await page.locator("button#register")
    await registerButton.click()
  }
  await takeScreenshot(page, "error_during_register.png")
  await page.reload()
  await waitForPageReady(page)

  // register a version without error
  await clickToBuildStory(page, "no_error")
  {
    const registerButton = await page.locator("button#register")
    await registerButton.click()
  }
  // try to update no_error -> error_during_register
  await clickToBuildStory(page, "error_during_register")
  await clickToCheckUpdate(page)
  await takeScreenshot(page, "error_during_register_found.png")
} finally {
  if (!debug) {
    browser.close()
    buildServer.stop()
  }
}
