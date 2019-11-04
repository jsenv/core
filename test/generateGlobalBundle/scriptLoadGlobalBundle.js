import { startServer, firstService, serveFile } from "@dmail/server"
import { resolveDirectoryUrl, resolveFileUrl, fileUrlToPath } from "src/private/urlUtils.js"

const puppeteer = import.meta.require("puppeteer")

export const scriptLoadGlobalBundle = async ({
  projectDirectoryUrl,
  bundleDirectoryRelativePath,
  mainRelativePath,
  globalName,
}) => {
  const bundleDirectoryUrl = resolveDirectoryUrl(bundleDirectoryRelativePath, projectDirectoryUrl)
  const [server, browser] = await Promise.all([
    startTestServer({ bundleDirectoryUrl }),
    puppeteer.launch(),
  ])

  const page = await browser.newPage()
  await page.goto(`${server.origin}/`)
  // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pageaddscripttagoptions
  await page.addScriptTag({
    url: mainRelativePath,
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
  serveFile(fileUrlToPath(resolveFileUrl(ressource.slice(1), bundleDirectoryUrl)), {
    method,
    headers,
  })
