import { chromium } from "playwright"
import { readFile, writeFile } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { jsenvPluginPreact } from "@jsenv/plugin-preact"

const countLabelJsxFileUrl = new URL("./client/main.jsx", import.meta.url)
const countLabelJsxFileContent = {
  beforeTest: await readFile(countLabelJsxFileUrl),
  update: (content) => writeFile(countLabelJsxFileUrl, content),
  restore: () =>
    writeFile(countLabelJsxFileUrl, countLabelJsxFileContent.beforeTest),
}

const devServer = await startDevServer({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  autoreload: {
    cooldownBetweenFileEvents: 250,
  },
  plugins: [jsenvPluginPreact()],
})
const browser = await chromium.launch({
  headless: true,
})
const pageLogs = []
const expectedPageLogs = []
const page = await browser.newPage({ ignoreHTTPSErrors: true })
page.on("console", (message) => {
  pageLogs.push({ type: message.type(), text: message.text() })
})
await page.goto(`${devServer.origin}/main.html`)
await page.evaluate(
  /* eslint-disable no-undef */
  () => window.readyPromise,
  /* eslint-enable no-undef */
)
const getCountLabelText = () => {
  return page.evaluate(
    /* eslint-disable no-undef */
    () => {
      return document.querySelector("#count_label").innerHTML
    },
    /* eslint-enable no-undef */
  )
}

{
  const actual = {
    countLabelText: await getCountLabelText(),
    pageLogs,
  }
  const expected = {
    countLabelText: "toto: 0",
    pageLogs: expectedPageLogs,
  }
  assert({ actual, expected })
}

browser.close()
countLabelJsxFileContent.restore()
