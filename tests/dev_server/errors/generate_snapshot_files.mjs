import { writeFileSync } from "node:fs"
import { chromium } from "playwright"

process.env.GENERATING_SNAPSHOTS = "true"
const { devServer } = await import("./start_dev_server.mjs")
const browser = await chromium.launch({ headless: true })

const generateHtmlForStory = async ({ story }) => {
  const page = await browser.newPage()
  await page.goto(`${devServer.origin}/${story}/main.html`)
  await page.waitForSelector("jsenv-error-overlay")
  const htmlGenerated = await page.evaluate(
    /* eslint-disable no-undef */
    async () => {
      return document
        .querySelector("jsenv-error-overlay")
        .shadowRoot.querySelector(".overlay").outerHTML
    },
    /* eslint-enable no-undef */
  )
  await page.close()

  writeFileSync(
    new URL(`./snapshots/${story}.html`, import.meta.url),
    htmlGenerated,
  )
}

try {
  await generateHtmlForStory({
    story: "js_export_not_found",
  })
} finally {
  browser.close()
  devServer.stop()
}
