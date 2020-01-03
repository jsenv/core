import { startServer, firstService, serveFile } from "@jsenv/server"
import { resolveDirectoryUrl, resolveUrl, readFileContent } from "@jsenv/util"

const puppeteer = import.meta.require("puppeteer")

const SYSTEM_PATH = import.meta.require.resolve("systemjs/dist/system.js")

export const browserImportSystemJsBundle = async ({
  projectDirectoryUrl,
  testDirectoryRelativeUrl,
  htmlFileRelativeUrl = "./index.html",
  mainRelativeUrl,
  headless = true,
}) => {
  const testDirectoryUrl = resolveDirectoryUrl(testDirectoryRelativeUrl, projectDirectoryUrl)
  const [server, browser] = await Promise.all([
    startTestServer({ testDirectoryUrl }),
    puppeteer.launch({
      headless,
    }),
  ])

  const page = await browser.newPage()
  await page.goto(resolveUrl(htmlFileRelativeUrl, server.origin))

  try {
    const namespace = await page.evaluate(
      /* istanbul ignore next */
      ({ specifier }) => {
        return window.System.import(specifier)
      },
      {
        specifier: mainRelativeUrl,
      },
    )
    return {
      namespace,
      serverOrigin: server.origin,
    }
  } finally {
    browser.close()
    server.stop()
  }
}

const startTestServer = ({ testDirectoryUrl }) => {
  return startServer({
    logLevel: "off",
    requestToResponse: (request) =>
      firstService(
        () => serveSystemJS({ request }),
        () => serveTestDirectory({ testDirectoryUrl, request }),
      ),
  })
}

const serveSystemJS = async ({ request: { ressource } }) => {
  if (ressource !== "/system.js") return null

  const content = await readFileContent(SYSTEM_PATH)

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

const serveTestDirectory = ({ testDirectoryUrl, request: { ressource, method, headers } }) =>
  serveFile(resolveUrl(ressource.slice(1), testDirectoryUrl), {
    method,
    headers,
  })
