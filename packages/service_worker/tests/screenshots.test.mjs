/*
 * start a build server
 * open a chrome on that build server (playwright)
 * open 2 tabs on that same html page
 * take a screenshot of both tabs
 * register the worker
 * wait a bit then take a screenshot of both tabs
 * refresh + take a new screenshot
 *
 * now regen a new build updating the animal url
 * call check for updates on tab 1
 * take a screenshot of both tabs
 * resolve install
 * take a screenshot (we should see that update can be activated and page will reload)
 * activate it
 * ensure both tabs are reloaded
 * take a screenshot of both tabs
 *
 * now check the checkbox to allow hot update
 * rebuild a new animal and recheck everything is fine
 *
 * TO BE TESTED TOO (somewhere else)
 * when there is an error during install/activate
 * the service worker is still registered and cannot be unregistered by API
 * test that is we rebuild a correct service worker (one that does not throw)
 * the registration happens somehow and everything works fine
 * test this also when the update fails to install/activate
 */

import { writeFileSync } from "node:fs"
import { chromium } from "playwright"
import { buildServer } from "./screenshot_build_server.mjs"

const debug = false
const browser = await chromium.launch({ headless: !debug })
const openPage = async (url) => {
  const page = await browser.newPage({ ignoreHTTPSErrors: true })
  await page.setViewportSize({ width: 400, height: 200 }) // set a relatively small and predicatble size
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.error(message.text())
    }
  })
  page.on("pageerror", (error) => {
    throw error
  })
  await page.goto(url)
  return page
}
const takePageUIScreenshot = async (page, { name }) => {
  const sceenshotBuffer = await page.locator("#ui").screenshot()
  writeFileSync(
    new URL(`./screenshots/${name}`, import.meta.url),
    sceenshotBuffer,
  )
}

try {
  const pageA = await openPage(`${buildServer.origin}/main.html`)
  const pageB = await openPage(`${buildServer.origin}/main.html`)

  await takePageUIScreenshot(pageA, { name: "0_a_before_register.png" })
  await takePageUIScreenshot(pageB, { name: "0_b_before_register.png" })
} finally {
  if (!debug) {
    browser.close()
    buildServer.stop()
  }
}
