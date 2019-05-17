import { fileRead } from "@dmail/helper"
import { serveFile } from "../../src/file-service/index.js"
import { startServer, firstService } from "../../src/server/index.js"
import { SYSTEM_PATHNAME } from "../../src/system/index.js"
import { pathnameToOperatingSystemFilename } from "../../src/operating-system-filename.js"

const puppeteer = import.meta.require("puppeteer")

export const importBrowserBundle = async ({ bundleFolder, file }) => {
  bundleFolder = pathnameToOperatingSystemFilename(bundleFolder)

  const [server, browser] = await Promise.all([
    startTestServer({ bundleFolder }),
    puppeteer.launch(),
  ])

  const page = await browser.newPage()
  await page.goto(`${server.origin}/`)

  try {
    const namespace = await page.evaluate(
      ({ specifier }) => {
        // eslint-disable-next-line no-undef
        return System.import(specifier)
      },
      {
        specifier: `./${file}`,
      },
    )
    return { namespace, serverOrigin: server.origin }
  } finally {
    browser.close()
    server.stop()
  }
}

const startTestServer = ({ bundleFolder }) => {
  return startServer({
    logLevel: "off",
    requestToResponse: (request) =>
      firstService(
        () => serveIndexPage({ request }),
        () => serveSystemJS({ request }),
        () => serveBundleFolder({ bundleFolder, request }),
      ),
  })
}

const serveIndexPage = ({ request: { method, ressource } }) => {
  if (method !== "GET") return null
  if (ressource !== "/") return null

  const html = genereateIndexPage()

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

const genereateIndexPage = () => `<!doctype html>

<head>
  <title>Untitled</title>
  <meta charset="utf-8" />
</head>

<body>
  <main></main>
  <script src="system.js"></script>
</body>

</html>`

const serveSystemJS = async ({ request: { ressource } }) => {
  if (ressource !== "/system.js") return null

  const content = await fileRead(pathnameToOperatingSystemFilename(SYSTEM_PATHNAME))

  return {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/javascript",
      "content-length": Buffer.byteLength(content),
    },
    body: content,
  }
}

const serveBundleFolder = ({ bundleFolder, request: { ressource, method, headers } }) => {
  return serveFile(`${bundleFolder}${ressource}`, { method, headers })
}
