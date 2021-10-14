import { startServer, composeServices, serveFile } from "@jsenv/server"
import { resolveDirectoryUrl, resolveUrl, readFile } from "@jsenv/filesystem"

import { require } from "@jsenv/core/src/internal/require.js"

const { chromium } = require("playwright")

const SYSTEM_PATH = require.resolve("systemjs/dist/system.js")

export const browserImportSystemJsBuild = async ({
  projectDirectoryUrl,
  testDirectoryRelativeUrl,
  htmlFileRelativeUrl = "./dist/systemjs/main.html",
  mainRelativeUrl,
  debug = false,
  codeToRunInBrowser = undefined,
  headless = !debug,
  autoStop = !debug,
}) => {
  if (!mainRelativeUrl && !codeToRunInBrowser) {
    throw new TypeError(
      `mainRelativeUrl must be a string, received ${mainRelativeUrl}`,
    )
  }

  const testDirectoryUrl = resolveDirectoryUrl(
    testDirectoryRelativeUrl,
    projectDirectoryUrl,
  )
  const [server, browser] = await Promise.all([
    startTestServer({ testDirectoryUrl }),
    chromium.launch({
      headless,
    }),
  ])

  const page = await browser.newPage({ ignoreHTTPSErrors: true })
  await page.goto(resolveUrl(htmlFileRelativeUrl, server.origin))

  try {
    const namespace = await page.evaluate(
      /* istanbul ignore next */
      ({ codeToRunInBrowser, debug, specifier }) => {
        /* globals window */

        if (codeToRunInBrowser) {
          // eslint-disable-next-line no-eval
          return window.eval(codeToRunInBrowser)
        }

        if (debug) {
          window.run = () => window.System.import(specifier)
          return `not avaible because debug: true`
        }
        return window.System.import(specifier)
      },
      {
        codeToRunInBrowser,
        debug,
        specifier: mainRelativeUrl,
      },
    )
    return {
      namespace,
      serverOrigin: server.origin,
    }
  } finally {
    if (autoStop) {
      browser.close()
      server.stop()
    }
  }
}

const startTestServer = ({ testDirectoryUrl }) => {
  return startServer({
    logLevel: "error",
    protocol: "http",
    requestToResponse: composeServices(
      (request) => serveSystemJS({ request }),
      (request) => serveTestDirectory({ testDirectoryUrl, request }),
    ),
  })
}

const serveSystemJS = async ({ request: { ressource } }) => {
  if (ressource !== "/system.js") return null

  const content = await readFile(SYSTEM_PATH)

  return {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/javascript",
      "content-length": Buffer.byteLength(content),
    },
    body: content,
  }
}

const serveTestDirectory = ({ testDirectoryUrl, request }) =>
  serveFile(request, {
    rootDirectoryUrl: testDirectoryUrl,
  })
