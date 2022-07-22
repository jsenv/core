import { writeFileSync } from "node:fs"
import { chromium } from "playwright"

process.env.GENERATING_SNAPSHOTS = "true"
const { devServer } = await import("./start_dev_server.mjs")
const browser = await chromium.launch({ headless: true })

const generateHtmlForStory = async ({ story, waitForServerErrorReporting }) => {
  const page = await browser.newPage()
  await page.goto(`${devServer.origin}/${story}/main.html`)
  await page.waitForSelector("jsenv-error-overlay")
  if (waitForServerErrorReporting) {
    // wait a bit more to let server error replace browser error
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  const htmlGenerated = await page.evaluate(
    /* eslint-disable no-undef */
    async () => {
      const outerHtml = document
        .querySelector("jsenv-error-overlay")
        .shadowRoot.querySelector(".overlay").outerHTML
      return outerHtml
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, `"`)
        .replace(/&#039;/g, `'`)
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
  await generateHtmlForStory({
    story: "js_import_not_found",
    waitForServerErrorReporting: true,
  })
} finally {
  browser.close()
  devServer.stop()
}
