import { startServer, composeService, serveFile } from "@jsenv/server"
import { resolveDirectoryUrl } from "@jsenv/util"
import { require } from "@jsenv/core/src/internal/require.js"

const { chromium } = require("playwright")

export const browserImportEsModuleBuild = async ({
  projectDirectoryUrl,
  testDirectoryRelativeUrl,
  mainRelativeUrl,
  awaitNamespace = true,
  debug = false,
}) => {
  const testDirectoryUrl = resolveDirectoryUrl(testDirectoryRelativeUrl, projectDirectoryUrl)
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
  await page.goto(`${server.origin}/`)

  try {
    const namespace = await page.evaluate(
      `(async () => {
  const mainRelativeUrl = ${JSON.stringify(mainRelativeUrl)}
  const awaitNamespace = ${JSON.stringify(awaitNamespace)}
  const namespace = await import(mainRelativeUrl)
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
})()`,
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
    protocol: "https",
    requestToResponse: composeService(
      (request) => serveIndexPage({ request }),
      (request) =>
        serveFile(request, {
          rootDirectoryUrl: testDirectoryUrl,
        }),
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
