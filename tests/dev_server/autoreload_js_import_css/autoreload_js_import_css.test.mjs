import { readFileSync, writeFileSync } from "node:fs"
import { chromium, firefox } from "playwright"
import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"

const test = async ({
  browserLauncher,
  pageLogsAfterUpdatingCssFile = [
    {
      type: "startGroupCollapsed",
      text: "[jsenv] hot reloading file.js",
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
      text: browserLauncher === firefox ? "" : "console.groupEnd",
    },
  ],
  pageLogsAfterRemovingCssImport,
  pageLogsAfterRestoringCssImport,
  ...rest
}) => {
  const jsFileUrl = new URL("./client/main.js", import.meta.url)
  const jsFileContent = {
    beforeTest: readFileSync(jsFileUrl),
    update: (content) => writeFileSync(jsFileUrl, content),
    restore: () => writeFileSync(jsFileUrl, jsFileContent.beforeTest),
  }
  const cssFileUrl = new URL("./client/style.css", import.meta.url)
  const cssFileContent = {
    beforeTest: readFileSync(cssFileUrl),
    update: (content) => writeFileSync(cssFileUrl, content),
    restore: () => writeFileSync(cssFileUrl, cssFileContent.beforeTest),
  }

  const devServer = await startDevServer({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    cooldownBetweenFileEvents: 250,
    clientFiles: {
      "./**": true,
      "./**/.*/": false,
    },
    ...rest,
  })
  const browser = await browserLauncher.launch({ headless: true })
  try {
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
    await new Promise((resolve) => setTimeout(resolve, 500))
    cssFileContent.update(`body { background: green; }`)
    await new Promise((resolve) => setTimeout(resolve, 500))
    {
      const actual = {
        bodyBackgroundColor: await getDocumentBodyBackgroundColor(),
        pageLogs,
      }
      expectedPageLogs.push(...pageLogsAfterUpdatingCssFile)
      const expected = {
        bodyBackgroundColor: "rgb(0, 128, 0)", // green
        pageLogs: expectedPageLogs,
      }
      assert({ actual, expected })
    }
    // remove usage of the css file
    jsFileContent.update(`if (import.meta.hot) { import.meta.hot.accept() }`)
    await new Promise((resolve) => setTimeout(resolve, 500))
    {
      const actual = {
        bodyBackgroundColor: await getDocumentBodyBackgroundColor(),
        pageLogs,
      }
      expectedPageLogs.push(...pageLogsAfterRemovingCssImport)
      const expected = {
        bodyBackgroundColor: "rgba(0, 0, 0, 0)",
        pageLogs: expectedPageLogs,
      }
      assert({ actual, expected })
    }
    // restore deps on css file
    jsFileContent.update(`import "./file.js"

if (import.meta.hot) {
  import.meta.hot.accept()
}`)
    await new Promise((resolve) => setTimeout(resolve, 500))
    {
      const actual = {
        bodyBackgroundColor: await getDocumentBodyBackgroundColor(),
        pageLogs,
      }
      expectedPageLogs.push(...pageLogsAfterRestoringCssImport)
      const expected = {
        bodyBackgroundColor: "rgb(0, 128, 0)", // green
        pageLogs: expectedPageLogs,
      }
      assert({ actual, expected })
    }
  } finally {
    browser.close()
    jsFileContent.restore()
    cssFileContent.restore()
    await devServer.stop()
  }
}

// TODO: fix on windows
if (process.platform !== "win32") {
  // not transpiling import assertion (chrome)
  await test({
    browserLauncher: chromium,
    pageLogsAfterRemovingCssImport: [
      {
        type: "startGroupCollapsed",
        text: "[jsenv] hot reloading main.js",
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
        type: "startGroupCollapsed",
        text: "[jsenv] cleanup file.js (previously used in main.js)",
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
        type: "endGroup",
        text: "console.groupEnd",
      },
    ],
    pageLogsAfterRestoringCssImport: [
      {
        type: "startGroupCollapsed",
        text: "[jsenv] hot reloading main.js",
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
  })

  // transpiling import assertion (firefox)
  await test({
    browserLauncher: firefox,
    pageLogsAfterRemovingCssImport: [
      {
        type: "startGroupCollapsed",
        text: "[jsenv] hot reloading main.js",
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
        text: "",
      },
      {
        type: "startGroupCollapsed",
        text: "[jsenv] cleanup file.js (previously used in main.js)",
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
        type: "endGroup",
        text: "",
      },
    ],
    pageLogsAfterRestoringCssImport: [
      {
        type: "startGroupCollapsed",
        text: "[jsenv] hot reloading main.js",
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
        text: "",
      },
    ],
  })
}
