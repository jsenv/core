import { startServer, firstService, serveFile } from "@jsenv/server"
import { resolveDirectoryUrl, resolveUrl, urlToFileSystemPath } from "@jsenv/util"
import { require } from "../../src/internal/require.js"

const puppeteer = require("puppeteer")

export const browserImportBundle = async ({
  projectDirectoryUrl,
  bundleDirectoryRelativeUrl,
  mainRelativeUrl,
  namespaceProperty = "default",
}) => {
  const bundleDirectoryUrl = resolveDirectoryUrl(bundleDirectoryRelativeUrl, projectDirectoryUrl)
  const [server, browser] = await Promise.all([
    startTestServer({ bundleDirectoryUrl }),
    puppeteer.launch({
      // headless: false,
      // handleSIGINT: false,
      // handleSIGTERM: false,
      // handleSIGHUP: false,
    }),
  ])

  const page = await browser.newPage()
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
    browser.close()
    server.stop()
  }
}

const startTestServer = ({ bundleDirectoryUrl }) => {
  return startServer({
    logLevel: "off",
    requestToResponse: (request) =>
      firstService(
        () => serveIndexPage({ request }),
        () => serveBundleDirectory({ bundleDirectoryUrl, request }),
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
