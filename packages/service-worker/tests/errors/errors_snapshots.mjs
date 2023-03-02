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
import { buildServer } from "./errors_build_server.mjs"

const snapshotsDirectoryUrl = new URL("./snapshots/html/", import.meta.url)
await ensureEmptyDirectory(snapshotsDirectoryUrl)
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
let snapshotCount = 0
const takeSnapshots = async (page, name) => {
  name = `${snapshotCount}_${name}`
  snapshotCount++
  const task = createTaskLog(`snapshoting "${name}" on chromium`, {
    disabled: process.env.FROM_TESTS,
  })
  const uiLocator = await page.locator("#ui")
  if (!process.env.FROM_TESTS) {
    const uiScreenshotBuffer = await uiLocator.screenshot()
    writeFileSync(
      new URL(`./snapshots/screen/${name}.png`, import.meta.url),
      uiScreenshotBuffer,
    )
  }
  const uiHtml = await page.evaluate(
    /* eslint-disable no-undef */
    async () => {
      return document
        .querySelector("#ui")
        .outerHTML.replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, `"`)
        .replace(/&#039;/g, `'`)
    },
    /* eslint-enable no-undef */
  )
  writeFileSync(
    new URL(`./snapshots/html/${name}.html`, import.meta.url),
    uiHtml,
  )
  task.done()
}

try {
  const htmlUrl = `${buildServer.origin}/main.html`
  const page = await openPage(htmlUrl)

  await waitForPageReady(page)
  await takeSnapshots(page, "after_load")

  // error during first register
  await clickToBuildStory(page, "error_during_register")
  {
    const registerButton = await page.locator("button#register")
    await registerButton.click()
  }
  await takeSnapshots(page, "error_during_register")
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
  await takeSnapshots(page, "error_during_register_found")
} finally {
  if (!debug) {
    browser.close()
    buildServer.stop()
  }
}
