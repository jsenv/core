import { startServer, composeServices, serveFile } from "@jsenv/server"
import { resolveDirectoryUrl } from "@jsenv/filesystem"

import { require } from "@jsenv/core/src/internal/require.js"

const { chromium } = require("playwright")

export const scriptLoadGlobalBuild = async ({
  projectDirectoryUrl,
  buildDirectoryRelativeUrl,
  mainRelativeUrl,
  globalName,
  debug = false,
}) => {
  const buildDirectoryUrl = resolveDirectoryUrl(
    buildDirectoryRelativeUrl,
    projectDirectoryUrl,
  )
  const [server, browser] = await Promise.all([
    startTestServer({ buildDirectoryUrl }),
    chromium.launch({
      headless: !debug,
    }),
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
    if (!debug) {
      browser.close()
      server.stop()
    }
  }
}

const startTestServer = ({ buildDirectoryUrl }) => {
  return startServer({
    logLevel: "off",
    protocol: "http",
    requestToResponse: composeServices(
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

const serveBuildDirectory = ({ buildDirectoryUrl, request }) =>
  serveFile(request, {
    rootDirectoryUrl: buildDirectoryUrl,
  })
