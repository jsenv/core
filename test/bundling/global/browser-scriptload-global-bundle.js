import { operatingSystemPathToPathname } from "@jsenv/operating-system-path"
import { serveFile } from "../../../src/file-service/index.js"
import { startServer, firstService } from "../../../src/server/index.js"

const puppeteer = import.meta.require("puppeteer")

export const browserScriptloadGlobalBundle = async ({
  projectPath,
  bundleIntoRelativePath,
  mainRelativePath,
  globalName,
}) => {
  const [server, browser] = await Promise.all([
    startTestServer({ projectPath, bundleIntoRelativePath }),
    puppeteer.launch(),
  ])

  const page = await browser.newPage()
  await page.goto(`${server.origin}/`)
  // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pageaddscripttagoptions
  await page.addScriptTag({
    url: `.${mainRelativePath}`,
  })

  try {
    const globalValue = await page.evaluate(
      // eslint-disable-next-line no-undef
      (globalName) => window[globalName],
      globalName,
    )
    return { globalValue, serverOrigin: server.origin }
  } finally {
    browser.close()
    server.stop()
  }
}

const startTestServer = ({ projectPath, bundleIntoRelativePath }) => {
  return startServer({
    logLevel: "off",
    requestToResponse: (request) =>
      firstService(
        () => serveIndexPage({ request }),
        () => serveBundleFolder({ projectPath, bundleIntoRelativePath, request }),
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

const serveBundleFolder = ({
  projectPath,
  bundleIntoRelativePath,
  request: { ressource, method, headers },
}) =>
  serveFile(`${operatingSystemPathToPathname(projectPath)}${bundleIntoRelativePath}${ressource}`, {
    method,
    headers,
  })
