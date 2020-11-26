import { startServer, firstService, serveFile } from "@jsenv/server"
import { resolveDirectoryUrl, resolveUrl, urlToFileSystemPath } from "@jsenv/util"
import { require } from "@jsenv/core/src/internal/require.js"

const { chromium } = require("playwright-chromium")

export const scriptLoadGlobalBundle = async ({
  projectDirectoryUrl,
  buildDirectoryRelativeUrl,
  mainRelativeUrl,
  globalName,
}) => {
  const bundleDirectoryUrl = resolveDirectoryUrl(buildDirectoryRelativeUrl, projectDirectoryUrl)
  const [server, browser] = await Promise.all([
    startTestServer({ bundleDirectoryUrl }),
    chromium.launch(),
  ])

  const page = await browser.newPage({ ignoreHTTPSErrors: true })
  await page.goto(`${server.origin}/`)
  // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pageaddscripttagoptions
  await page.addScriptTag({
    url: mainRelativeUrl,
  })

  try {
    const globalValue = await page.evaluate(
      // eslint-disable-next-line no-undef
      (globalName) => window[globalName],
      globalName,
    )
    return {
      globalValue,
      serverOrigin: server.origin,
    }
  } finally {
    browser.close()
    server.stop()
  }
}

const startTestServer = ({ bundleDirectoryUrl }) => {
  return startServer({
    logLevel: "off",
    protocol: "https",
    requestToResponse: firstService(
      (request) => serveIndexPage({ request }),
      (request) => serveBundleDirectory({ bundleDirectoryUrl, request }),
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

const serveBundleDirectory = ({ bundleDirectoryUrl, request: { ressource, method, headers } }) =>
  serveFile(urlToFileSystemPath(resolveUrl(ressource.slice(1), bundleDirectoryUrl)), {
    method,
    headers,
  })
