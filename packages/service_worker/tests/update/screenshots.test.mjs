/*
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

const debug = true
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
  page.on("pageerror", (error) => {
    throw error
  })
  await page.goto(url)
  return page
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
  await ensureEmptyDirectory(new URL("./screenshots/a/", import.meta.url))
  await ensureEmptyDirectory(new URL("./screenshots/b/", import.meta.url))
  const htmlUrl = `${buildServer.origin}/main.html`
  const pageA = await openPage(htmlUrl)
  const pageB = await openPage(htmlUrl)

  const waitForPagesReady = async () => {
    const pageAReadyPromise = pageA.evaluate(
      /* eslint-disable no-undef */
      () => window.readyPromise,
      /* eslint-enable no-undef */
    )
    const pageBReadyPromise = pageA.evaluate(
      /* eslint-disable no-undef */
      () => window.readyPromise,
      /* eslint-enable no-undef */
    )
    await Promise.all([pageAReadyPromise, pageBReadyPromise])
  }

  const takeScreenshot = async (page, name) => {
    const dirname = page === pageA ? "a" : "b"
    const sceenshotBuffer = await page.locator("#ui").screenshot()
    writeFileSync(
      new URL(`./screenshots/${dirname}/${name}`, import.meta.url),
      sceenshotBuffer,
    )
  }
  let screenshotCount = 0
  const takeScreenshots = async (name) => {
    name = `${screenshotCount}_${name}`
    screenshotCount++
    const task = createTaskLog(`screenshot ${name} on chromium`, {
      disabled: process.env.FROM_TESTS,
    })
    await takeScreenshot(pageA, name)
    await takeScreenshot(pageB, name)
    task.done()
  }
  const clickToHotReplace = async () => {
    const pageAUpdateNowButton = await pageA.locator("#update_now_button")
    await pageAUpdateNowButton.click()
    // wait a bit, corresponds to:
    // - time for service worker to switch from "installed" to "activated"
    //   (execution of "activate" event)
    // - time for service_worker_facade to hot replace (a fetch request to new url)
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }

  await waitForPagesReady()
  await takeScreenshots("dog_after_load.png")
  const pageARegisterButton = await pageA.locator("button#register")
  await pageARegisterButton.click()
  await new Promise((resolve) => setTimeout(resolve, 1_000))
  await takeScreenshots("dog_after_register.png")
  await Promise.all([pageA.reload(), pageB.reload()])
  await waitForPagesReady()
  await takeScreenshots("dog_after_reload.png")

  await clickToBuildAnimal(pageA, "cat")
  await clickToCheckUpdate(pageA)
  await takeScreenshots("cat_found.png")
  const pageARestartButton = await pageA.locator(
    "button#update_by_restart_button",
  )
  const pageAReloadPromise = pageA.waitForNavigation()
  const pageBReloadPromise = pageB.waitForNavigation()
  await pageARestartButton.click()
  await pageAReloadPromise
  await pageBReloadPromise
  await waitForPagesReady()
  await takeScreenshots("cat_after_reload.png")

  const pageAHotUpdateCheckbox = await pageA.locator("input#image_hot_update")
  await pageAHotUpdateCheckbox.click()
  const pageBHotUpdateCheckbox = await pageB.locator("input#image_hot_update")
  await pageBHotUpdateCheckbox.click()
  await clickToBuildAnimal(pageA, "horse")
  await clickToCheckUpdate(pageA)
  await takeScreenshots("horse_found.png")
  await clickToHotReplace(pageA)

  await takeScreenshots("horse_after_hot_replace.png")
  await clickToBuildAnimal(pageA, "bear")
  await clickToCheckUpdate(pageA)
  await takeScreenshots("bear_found.png")
  await clickToHotReplace(pageA)
  await takeScreenshots("bear_after_hot_replace.png")

  // ensure going back to horse is possible
  await clickToBuildAnimal(pageA, "horse")
  await clickToCheckUpdate(pageA)
  await clickToHotReplace(pageA)
  await takeScreenshots("back_to_horse.png")
} finally {
  if (!debug) {
    browser.close()
    buildServer.stop()
  }
}
