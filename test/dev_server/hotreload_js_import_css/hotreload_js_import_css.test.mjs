import { chromium } from "playwright"
import { writeFile } from "@jsenv/filesystem"

import { startDevServer } from "@jsenv/core"
import { assert } from "@jsenv/assert"

const devServer = await startDevServer({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
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
const getDocumentBodyBackgroundColor = () => {
  return page.evaluate(
    /* eslint-disable no-undef */
    () => {
      return window.getComputedStyle(document.body).backgroundColor
    },
    /* eslint-enable no-undef */
  )
}

{
  const actual = {
    bodyBackGroundColor: await getDocumentBodyBackgroundColor(),
    pageLogs,
  }
  expectedPageLogs.push({
    type: "log",
    text: "adding stylesheet",
  })
  const expected = {
    bodyBackGroundColor: "rgb(255, 0, 0)", // red
    pageLogs: expectedPageLogs,
  }
  assert({ actual, expected })
}
await writeFile(
  new URL("./client/style.css", import.meta.url),
  `body { background: green; }`,
)
await new Promise((resolve) => setTimeout(resolve, 500))
{
  const actual = {
    bodyBackGroundColor: await getDocumentBodyBackgroundColor(),
  }
  expectedPageLogs.push({
    type: "log",
    value: "adding stylesheet",
  })
  const expected = {
    bodyBackGroundColor: "rgb(0, 128, 0)",
    pageLogs: expectedPageLogs,
  }
  assert({ actual, expected })
}
// remove usage of the css file
await writeFile(
  new URL("./client/main.js", import.meta.url),
  `if (import.meta.hot) { import.meta.hot.accept() }`,
)
await new Promise((resolve) => setTimeout(resolve, 500))
{
  const actual = await getDocumentBodyBackgroundColor()
  const expected = undefined
  assert({ actual, expected })
}
// restore deps on css file
await writeFile(
  new URL("./client/main.js", import.meta.url),
  `import "./file.js"

if (import.meta.hot) {
  import.meta.hot.accept()
}
`,
)
await new Promise((resolve) => setTimeout(resolve, 500))
{
  const actual = await getDocumentBodyBackgroundColor()
  const expected = "green"
  assert({ actual, expected })
}
