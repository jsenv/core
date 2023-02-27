/*
 * TODO: version must be used to represent sw script code
 * name could be used to represent something for debug purposes
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
import { ensureEmptyDirectory } from "@jsenv/filesystem"
import { createTaskLog } from "@jsenv/log"
import { buildServer } from "./screenshot_build_server.mjs"

const debug = false
const browser = await chromium.launch({ headless: !debug })
const context = await browser.newContext()
const openPage = async (url) => {
  const page = await context.newPage({ ignoreHTTPSErrors: true })
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
const clickToBuildAnimal = async (page, animalName) => {
  const buildButton = await page.locator(`button#build_${animalName}`)
  await buildButton.click()
  await new Promise((resolve) => setTimeout(resolve, 1_000))
}
const clickToCheckUpdate = async (page) => {
  const updateCheckButton = await page.locator("button#update_check_button")
  await updateCheckButton.click()
}

try {
  await ensureEmptyDirectory(new URL("./screenshots/", import.meta.url))
  const htmlUrl = `${buildServer.origin}/main.html`
  const pageA = await openPage(htmlUrl)
  const pageB = await openPage(htmlUrl)
  let screenshotCount = 0
  const takeScreenshots = async (name) => {
    screenshotCount++
    await takePageUIScreenshot(pageA, { name: `${screenshotCount}_a_${name}` })
    await takePageUIScreenshot(pageB, { name: `${screenshotCount}_b_${name}` })
  }

  await takeScreenshots("before_register.png")
  const pageARegisterButton = await pageA.locator("button#register")
  await pageARegisterButton.click()
  await new Promise((resolve) => setTimeout(resolve, 1_000))
  await takeScreenshots("after_register.png")
  await Promise.all([pageA.reload(), pageB.reload()])
  await takeScreenshots("after_reload.png")

  await clickToBuildAnimal(pageA, "cat")
  await clickToCheckUpdate(pageA)
  await takeScreenshots("update_by_reload_available.png")
  const pageARestartButton = await pageA.locator(
    "button#update_by_restart_button",
  )
  const pageAReloadPromise = pageA.waitForNavigation()
  const pageBReloadPromise = pageB.waitForNavigation()
  await pageARestartButton.click()
  await pageAReloadPromise
  await pageBReloadPromise
  await takeScreenshots("after_update_by_reload.png")

  const pageAHotUpdateCheckbox = await pageA.locator("input#image_hot_update")
  await pageAHotUpdateCheckbox.click()
  await clickToBuildAnimal(pageA, "horse")
  await clickToCheckUpdate(pageA)
  await takeScreenshots("update_now_available.png")
  const pageAUpdateNowButton = await pageA.locator("#update_now_button")
  await pageAUpdateNowButton.click()
  await takeScreenshots("update_now_applied.png")
  // then rebuild again to ensure we can update hot twice in a row
} finally {
  if (!debug) {
    browser.close()
    buildServer.stop()
  }
}
