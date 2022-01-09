import { startServer, composeServices, fetchFileSystem } from "@jsenv/server"

import { require } from "@jsenv/core/src/internal/require.js"

const { chromium } = require("playwright")

export const executeFileUsingBrowserScript = async ({
  rootDirectoryUrl,
  jsFileRelativeUrl,
  globalName,
  debug = false,
}) => {
  const [server, browser] = await Promise.all([
    startTestServer({ rootDirectoryUrl }),
    chromium.launch({
      headless: !debug,
    }),
  ])

  const page = await browser.newPage({ ignoreHTTPSErrors: true })
  await page.goto(`${server.origin}/`)
  // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pageaddscripttagoptions
  await page.addScriptTag({
    url: jsFileRelativeUrl,
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

const startTestServer = ({ rootDirectoryUrl }) => {
  return startServer({
    logLevel: "off",
    protocol: "http",
    requestToResponse: composeServices({
      index: (request) => serveIndexPage({ request }),
      static: (request) =>
        fetchFileSystem(new URL(request.ressource.slice(1), rootDirectoryUrl), {
          headers: request.headers,
          rootDirectoryUrl,
        }),
    }),
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
