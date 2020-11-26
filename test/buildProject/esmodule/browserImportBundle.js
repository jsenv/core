import { startServer, firstService, serveFile } from "@jsenv/server"
import { resolveDirectoryUrl, resolveUrl, urlToFileSystemPath } from "@jsenv/util"
import { require } from "@jsenv/core/src/internal/require.js"

const { chromium } = require("playwright-chromium")

export const browserImportBundle = async ({
  projectDirectoryUrl,
  buildDirectoryRelativeUrl,
  mainRelativeUrl,
  namespaceProperty = "default",
  headless = true,
  stopAfterImport = true,
}) => {
  const buildDirectoryUrl = resolveDirectoryUrl(buildDirectoryRelativeUrl, projectDirectoryUrl)
  const [server, browser] = await Promise.all([
    startTestServer({ buildDirectoryUrl }),
    chromium.launch({
      headless,
      // handleSIGINT: false,
      // handleSIGTERM: false,
      // handleSIGHUP: false,
    }),
  ])

  const page = await browser.newPage({ ignoreHTTPSErrors: true })
  await page.goto(`${server.origin}/`)

  try {
    const value = await page.evaluate(
      `(async () => {
  const namespace = await import(${JSON.stringify(mainRelativeUrl)})
  const value = await namespace[${JSON.stringify(namespaceProperty)}]
  return value
})()`,
    )
    return {
      value,
      serverOrigin: server.origin,
    }
  } finally {
    if (stopAfterImport) {
      browser.close()
      server.stop()
    }
  }
}

const startTestServer = ({ buildDirectoryUrl }) => {
  return startServer({
    logLevel: "off",
    protocol: "https",
    requestToResponse: firstService(
      (request) => serveIndexPage({ request }),
      (request) => serveBundleDirectory({ buildDirectoryUrl, request }),
    ),
  })
}

const serveIndexPage = ({ request: { method, ressource } }) => {
  if (method !== "GET") return null
  if (ressource !== "/") return null

  const html = generateIndexPage()

  return {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/html",
      "content-length": Buffer.byteLength(html),
    },
    body: html,
  }
}

const generateIndexPage = () => `<!doctype html>

<head>
  <title>Untitled</title>
  <meta charset="utf-8" />
</head>

<body>
  <main></main>
</body>

</html>`

const serveBundleDirectory = ({ buildDirectoryUrl, request: { ressource, method, headers } }) =>
  serveFile(urlToFileSystemPath(resolveUrl(ressource.slice(1), buildDirectoryUrl)), {
    method,
    headers,
  })
