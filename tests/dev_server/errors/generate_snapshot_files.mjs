import { writeFileSync } from "@jsenv/filesystem"
import { chromium, firefox, webkit } from "playwright"

process.env.GENERATING_SNAPSHOTS = "true"
const { devServer } = await import("./start_dev_server.mjs")

const test = async ({ browserLauncher, browserName }) => {
  const browser = await browserLauncher.launch({ headless: true })
  const screenshotsDirectoryUrl = new URL(`./sceenshots/`, import.meta.url)
  const snapshotDirectoryUrl = new URL(`./snapshots/`, import.meta.url)

  const generateHtmlForStory = async ({
    story,
    preferServerErrorReporting,
  }) => {
    const page = await browser.newPage()
    await page.goto(`${devServer.origin}/${story}/main.html`)
    try {
      await page.waitForSelector("jsenv-error-overlay", { timeout: 5_000 })
    } catch (e) {
      throw new Error(
        `jsenv error overlay not displayed on ${browserName} for ${story}`,
      )
    }
    if (preferServerErrorReporting) {
      // wait a bit more to let server error replace browser error
      await new Promise((resolve) => setTimeout(resolve, 200))
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
    await page.setViewportSize({ width: 900, height: 550 }) // generate smaller screenshots
    const sceenshotBuffer = await page
      .locator("jsenv-error-overlay")
      .screenshot()
    writeFileSync(
      new URL(`./${story}_${browserName}.png`, screenshotsDirectoryUrl),
      sceenshotBuffer,
    )
    writeFileSync(
      new URL(`./${story}_${browserName}.html`, snapshotDirectoryUrl),
      process.platform === "win32"
        ? htmlGenerated.replace(/\r\n/g, "\n")
        : htmlGenerated,
    )
    await page.close()
  }

  try {
    await generateHtmlForStory({
      story: "js_export_not_found",
    })
    await generateHtmlForStory({
      story: "js_import_not_found",
      preferServerErrorReporting: true,
    })
    await generateHtmlForStory({
      story: "js_import_syntax_error",
    })
    await generateHtmlForStory({
      story: "js_throw",
    })
    await generateHtmlForStory({
      story: "plugin_error_transform",
      preferServerErrorReporting: true,
    })
    await generateHtmlForStory({
      story: "script_module_inline_export_not_found",
    })
    await generateHtmlForStory({
      story: "script_module_inline_import_not_found",
      preferServerErrorReporting: true,
    })
    await generateHtmlForStory({
      story: "script_module_inline_syntax_error",
    })
    await generateHtmlForStory({
      story: "script_module_inline_throw",
    })
    // TODO: re-enable this later on
    // await generateHtmlForStory({
    //   story: "script_src_not_found",
    // })
  } finally {
    browser.close()
  }
}

try {
  await test({
    browserLauncher: chromium,
    browserName: "chromium",
  })
  // await test({
  //   browserLauncher: firefox,
  //   browserName: "firefox",
  // })
  // await test({
  //   browserLauncher: webkit,
  //   browserName: "webkit",
  // })
} finally {
  devServer.stop()
}
