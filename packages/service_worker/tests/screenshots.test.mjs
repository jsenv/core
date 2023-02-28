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

  await takeScreenshots("dog_after_load.png")
  const pageARegisterButton = await pageA.locator("button#register")
  await pageARegisterButton.click()
  await new Promise((resolve) => setTimeout(resolve, 1_000))
  await takeScreenshots("dog_after_register.png")
  await Promise.all([pageA.reload(), pageB.reload()])
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
  await takeScreenshots("cat_activated_after_reload.png")

  const pageAHotUpdateCheckbox = await pageA.locator("input#image_hot_update")
  await pageAHotUpdateCheckbox.click()
  const pageBHotUpdateCheckbox = await pageB.locator("input#image_hot_update")
  await pageBHotUpdateCheckbox.click()
  await clickToBuildAnimal(pageA, "horse")
  await clickToCheckUpdate(pageA)
  await takeScreenshots("horse_found.png")
  {
    const pageAUpdateNowButton = await pageA.locator("#update_now_button")
    await pageAUpdateNowButton.click()
  }
  await new Promise((resolve) => setTimeout(resolve, 1_500))
  await takeScreenshots("horse_activated_after_hot_replace.png")
  await clickToBuildAnimal(pageA, "cat")
  await takeScreenshots("cat_found.png")
  {
    const pageAUpdateNowButton = await pageA.locator("#update_now_button")
    await pageAUpdateNowButton.click()
  }
  await takeScreenshots("cat_activated_after_hot_replace.png")
} finally {
  if (!debug) {
    browser.close()
    buildServer.stop()
  }
}
