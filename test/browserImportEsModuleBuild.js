import { startServer, composeServices, serveFile } from "@jsenv/server"
import { resolveDirectoryUrl, resolveUrl } from "@jsenv/filesystem"

import { require } from "@jsenv/core/src/internal/require.js"

const { chromium } = require("playwright")

export const browserImportEsModuleBuild = async ({
  projectDirectoryUrl,
  testDirectoryRelativeUrl,
  htmlFileRelativeUrl = "./dist/esmodule/main.html",
  jsFileRelativeUrl,
  codeToRunInBrowser,
  awaitNamespace = true,
  debug = false,
}) => {
  const testDirectoryUrl = resolveDirectoryUrl(
    testDirectoryRelativeUrl,
    projectDirectoryUrl,
  )
  const [server, browser] = await Promise.all([
    startTestServer({ testDirectoryUrl }),
    chromium.launch({
      headless: !debug,
      // handleSIGINT: false,
      // handleSIGTERM: false,
      // handleSIGHUP: false,
    }),
  ])

  const page = await browser.newPage({ ignoreHTTPSErrors: true })
  await page.goto(resolveUrl(htmlFileRelativeUrl, server.origin))

  try {
    const namespace = await page.evaluate(
      /* istanbul ignore next */
      ({ debug, jsFileRelativeUrl, codeToRunInBrowser, awaitNamespace }) => {
        if (codeToRunInBrowser) {
          // eslint-disable-next-line no-eval
          return window.eval(codeToRunInBrowser)
        }

        /* globals window */
        const run = async () => {
          const namespace = await import(jsFileRelativeUrl)
          if (debug) {
            // eslint-disable-next-line no-debugger
            debugger
          }
          if (!awaitNamespace) {
            return namespace
          }
          const namespaceAwaited = {}
          await Promise.all(
            Object.keys(namespace).map(async (key) => {
              namespaceAwaited[key] = await namespace[key]
            }),
          )
          return namespaceAwaited
        }

        if (debug) {
          window.run = run
          return "no available cause debug: true"
        }

        return run()
      },
      {
        debug,
        jsFileRelativeUrl,
        codeToRunInBrowser,
        awaitNamespace,
      },
    )

    return {
      namespace,
      serverOrigin: server.origin,
    }
  } finally {
    if (!debug) {
      browser.close()
      server.stop()
    }
  }
}

const startTestServer = ({ testDirectoryUrl }) => {
  return startServer({
    logLevel: "off",
    protocol: "http",
    requestToResponse: composeServices((request) =>
      serveFile(request, {
        rootDirectoryUrl: testDirectoryUrl,
      }),
    ),
  })
}
