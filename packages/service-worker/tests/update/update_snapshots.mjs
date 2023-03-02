import { writeFileSync } from "node:fs"
import { chromium } from "playwright"
import { ensureEmptyDirectory } from "@jsenv/filesystem"
import { createTaskLog } from "@jsenv/log"
import { buildServer } from "./update_build_server.mjs"

await ensureEmptyDirectory(new URL("./snapshots/html/a/", import.meta.url))
await ensureEmptyDirectory(new URL("./snapshots/html/b/", import.meta.url))
await ensureEmptyDirectory(new URL("./snapshots/screen/a/", import.meta.url))
await ensureEmptyDirectory(new URL("./snapshots/screen/b/", import.meta.url))
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
let snapshotCount = 0
const takeSnapshots = async ([pageA, pageB], name) => {
  name = `${snapshotCount}_${name}`
  snapshotCount++
  const task = createTaskLog(`snapshoting "${name}" on chromium`, {
    disabled: process.env.FROM_TESTS,
  })
  await takeSnapshot(pageA, `a/${name}`)
  await takeSnapshot(pageB, `b/${name}`)
  task.done()
}
const takeSnapshot = async (page, name) => {
  const uiLocator = await page.locator("#ui")
  const uiScreenshotBuffer = await uiLocator.screenshot()
  writeFileSync(
    new URL(`./snapshots/screen/${name}.png`, import.meta.url),
    uiScreenshotBuffer,
  )
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
}

try {
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
  const clickToHotReplace = async () => {
    const pageAUpdateNowButton = await pageA.locator("#update_now_button")
    await pageAUpdateNowButton.click()
    // wait a bit, corresponds to:
    // - time for service worker to switch from "installed" to "activated"
    //   (execution of "activate" event)
    // - time for service_worker_facade to hot replace (a fetch request to new url)
    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }

  await waitForPagesReady()
  await takeSnapshots([pageA, pageB], "after_load")
  const pageARegisterButton = await pageA.locator("button#register")
  await pageARegisterButton.click()
  await new Promise((resolve) => setTimeout(resolve, 1_000))
  await takeSnapshots([pageA, pageB], "dog_after_register")
  await Promise.all([pageA.reload(), pageB.reload()])
  await waitForPagesReady()
  await takeSnapshots([pageA, pageB], "dog_after_reload")

  await clickToBuildAnimal(pageA, "cat")
  await clickToCheckUpdate(pageA)
  await takeSnapshots([pageA, pageB], "cat_found")
  const pageARestartButton = await pageA.locator(
    "button#update_by_restart_button",
  )
  const pageAReloadPromise = pageA.waitForNavigation()
  const pageBReloadPromise = pageB.waitForNavigation()
  await pageARestartButton.click()
  await pageAReloadPromise
  await pageBReloadPromise
  await waitForPagesReady()
  await takeSnapshots([pageA, pageB], "cat_after_reload")

  const pageAHotUpdateCheckbox = await pageA.locator("input#image_hot_update")
  await pageAHotUpdateCheckbox.click()
  const pageBHotUpdateCheckbox = await pageB.locator("input#image_hot_update")
  await pageBHotUpdateCheckbox.click()
  await clickToBuildAnimal(pageA, "horse")
  await clickToCheckUpdate(pageA)
  await takeSnapshots([pageA, pageB], "horse_found")
  await clickToHotReplace(pageA)

  await takeSnapshots([pageA, pageB], "horse_after_hot_replace")
  await clickToBuildAnimal(pageA, "bear")
  await clickToCheckUpdate(pageA)
  await takeSnapshots([pageA, pageB], "bear_found")
  await clickToHotReplace(pageA)
  await takeSnapshots([pageA, pageB], "bear_after_hot_replace")

  // ensure going back to horse is possible
  await clickToBuildAnimal(pageA, "horse")
  await clickToCheckUpdate(pageA)
  await clickToHotReplace(pageA)
  await takeSnapshots([pageA, pageB], "back_to_horse")
} finally {
  if (!debug) {
    browser.close()
    buildServer.stop()
  }
}
