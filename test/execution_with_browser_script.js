import { chromium } from "playwright"
import { startServer, composeServices, fetchFileSystem } from "@jsenv/server"

export const executeFileUsingBrowserScript = async ({
  rootDirectoryUrl,
  jsFileRelativeUrl,
  pageFunction,
  pageArguments = [],
  debug = false,
}) => {
  const [server, browser] = await Promise.all([
    startFileServer({ rootDirectoryUrl }),
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
    const returnValue = await page.evaluate(pageFunction, ...pageArguments)
    return {
      returnValue,
      serverOrigin: server.origin,
    }
  } finally {
    if (!debug) {
      browser.close()
      server.stop()
    }
  }
}

const startFileServer = ({ rootDirectoryUrl }) => {
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
