import { startServer, firstService, serveFile } from "@jsenv/server"
import { resolveDirectoryUrl, resolveUrl, urlToFileSystemPath } from "@jsenv/util"
import { require } from "@jsenv/core/src/internal/require.js"

const { chromium } = require("playwright-chromium")

export const scriptLoadGlobalBuild = async ({
  projectDirectoryUrl,
  buildDirectoryRelativeUrl,
  mainRelativeUrl,
  globalName,
}) => {
  const buildDirectoryUrl = resolveDirectoryUrl(buildDirectoryRelativeUrl, projectDirectoryUrl)
  const [server, browser] = await Promise.all([
    startTestServer({ buildDirectoryUrl }),
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

const startTestServer = ({ buildDirectoryUrl }) => {
  return startServer({
    logLevel: "off",
    protocol: "https",
    requestToResponse: firstService(
      (request) => serveIndexPage({ request }),
      (request) => serveBuildDirectory({ buildDirectoryUrl, request }),
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

const serveBuildDirectory = ({ buildDirectoryUrl, request: { ressource, method, headers } }) =>
  serveFile(urlToFileSystemPath(resolveUrl(ressource.slice(1), buildDirectoryUrl)), {
    method,
    headers,
  })
