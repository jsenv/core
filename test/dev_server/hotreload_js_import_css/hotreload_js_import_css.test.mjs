import { chromium } from "playwright"
import { readFile, writeFile } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"

const jsFileUrl = new URL("./client/main.js", import.meta.url)
const jsFileContent = {
  beforeTest: await readFile(jsFileUrl),
  update: (content) => writeFile(jsFileUrl, content),
  restore: () => writeFile(jsFileUrl, jsFileContent.beforeTest),
}
const cssFileUrl = new URL("./client/style.css", import.meta.url)
const cssFileContent = {
  beforeTest: await readFile(cssFileUrl),
  update: (content) => writeFile(cssFileUrl, content),
  restore: () => writeFile(cssFileUrl, cssFileContent.beforeTest),
}

const devServer = await startDevServer({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  autoreload: {
    cooldownBetweenFileEvents: 250,
  },
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
    bodyBackgroundColor: await getDocumentBodyBackgroundColor(),
    pageLogs,
  }
  expectedPageLogs.push({
    type: "log",
    text: "adding stylesheet",
  })
  const expected = {
    bodyBackgroundColor: "rgb(255, 0, 0)", // red
    pageLogs: expectedPageLogs,
  }
  assert({ actual, expected })
}
await cssFileContent.update(`body { background: green; }`)
await new Promise((resolve) => setTimeout(resolve, 500))
{
  const actual = {
    bodyBackgroundColor: await getDocumentBodyBackgroundColor(),
    pageLogs,
  }
  expectedPageLogs.push(
    ...[
      {
        type: "startGroup",
        text: "[jsenv] hot reloading: file.js",
      },
      {
        type: "log",
        text: "call dispose callback",
      },
      {
        type: "log",
        text: "remove stylesheet",
      },
      {
        type: "log",
        text: "importing js module",
      },
      {
        type: "log",
        text: "adding stylesheet",
      },
      {
        type: "log",
        text: "js module import done",
      },
      {
        type: "endGroup",
        text: "console.groupEnd",
      },
    ],
  )
  const expected = {
    bodyBackgroundColor: "rgb(0, 128, 0)", // green
    pageLogs: expectedPageLogs,
  }
  assert({ actual, expected })
}
// remove usage of the css file
await jsFileContent.update(`if (import.meta.hot) { import.meta.hot.accept() }`)
await new Promise((resolve) => setTimeout(resolve, 500))
{
  const actual = {
    bodyBackgroundColor: await getDocumentBodyBackgroundColor(),
    pageLogs,
  }
  expectedPageLogs.push(
    ...[
      {
        type: "startGroup",
        text: "[jsenv] hot reloading: main.js",
      },
      {
        type: "log",
        text: "importing js module",
      },
      {
        type: "log",
        text: "js module import done",
      },
      {
        type: "endGroup",
        text: "console.groupEnd",
      },
      {
        type: "startGroup",
        text: "[jsenv] prune: style.css (inside main.js)",
      },
      {
        type: "log",
        text: "cleanup pruned url",
      },
      {
        type: "endGroup",
        text: "console.groupEnd",
      },
      {
        type: "startGroup",
        text: "[jsenv] prune: file.js (inside main.js)",
      },
      {
        type: "log",
        text: "call dispose callback",
      },
      {
        type: "log",
        text: "remove stylesheet",
      },
      {
        type: "log",
        text: "cleanup pruned url",
      },
      {
        type: "endGroup",
        text: "console.groupEnd",
      },
    ],
  )
  const expected = {
    bodyBackgroundColor: "rgba(0, 0, 0, 0)",
    pageLogs: expectedPageLogs,
  }
  assert({ actual, expected })
}
// restore deps on css file
await jsFileContent.update(`import "./file.js"

if (import.meta.hot) {
  import.meta.hot.accept()
}`)
await new Promise((resolve) => setTimeout(resolve, 500))
{
  const actual = {
    bodyBackgroundColor: await getDocumentBodyBackgroundColor(),
    pageLogs,
  }
  expectedPageLogs.push(
    ...[
      {
        type: "startGroup",
        text: "[jsenv] hot reloading: main.js",
      },
      {
        type: "log",
        text: "importing js module",
      },
      {
        type: "log",
        text: "adding stylesheet",
      },
      {
        type: "log",
        text: "js module import done",
      },
      {
        type: "endGroup",
        text: "console.groupEnd",
      },
    ],
  )
  const expected = {
    bodyBackgroundColor: "rgb(0, 128, 0)", // green
    pageLogs: expectedPageLogs,
  }
  assert({ actual, expected })
}

browser.close()
jsFileContent.restore()
cssFileContent.restore()
