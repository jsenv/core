import { chromium } from "playwright"

import { startDevServer } from "@jsenv/core"

const rootDirectoryUrl = new URL("./client/", import.meta.url)
const devServer = await startDevServer({
  rootDirectoryUrl,
  keepProcessAlive: false,
})
const browser = await chromium.launch({ headless: true })

const generateHtmlForError = async ({ error }) => {
  const page = await browser.newPage()
  await page.goto(`${devServer.origin}/main.html`)
  const htmlGenerated = await page.evaluate(
    /* eslint-disable no-undef */
    async ({ error, rootDirectoryUrl }) => {
      const html = await window.renderErrorHtml(error, {
        rootDirectoryUrl,
        openInEditor: true,
        // url,
        // line,
        // column,
        // requestedRessource,
        reportedBy: "browser",
      })
      return html
    },
    [
      {
        error,
        rootDirectoryUrl: rootDirectoryUrl.href,
      },
    ],
    /* eslint-disable no-undef */
  )
  await page.close()
  return htmlGenerated
}

try {
  const html = await generateHtmlForError({
    error: new Error("here"),
  })
  console.log(html)
} finally {
  browser.close()
}
