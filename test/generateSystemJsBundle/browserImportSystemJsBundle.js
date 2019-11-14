import { fileRead } from "@dmail/helper"
import { startServer, firstService, serveFile } from "@jsenv/server"
import { resolveDirectoryUrl, resolveFileUrl, fileUrlToPath } from "src/private/urlUtils.js"

const puppeteer = import.meta.require("puppeteer")

const SYSTEM_PATH = import.meta.require.resolve("systemjs/dist/system.js")

export const browserImportSystemJsBundle = async ({
  projectDirectoryUrl,
  testDirectoryRelativePath,
  htmlFileRelativePath = "./index.html",
  mainRelativePath,
  headless = true,
}) => {
  const testDirectoryUrl = resolveDirectoryUrl(testDirectoryRelativePath, projectDirectoryUrl)
  const [server, browser] = await Promise.all([
    startTestServer({ testDirectoryUrl }),
    puppeteer.launch({
      headless,
    }),
  ])

  const page = await browser.newPage()
  await page.goto(resolveFileUrl(htmlFileRelativePath, server.origin))

  try {
    const namespace = await page.evaluate(
      ({ specifier }) => {
        // eslint-disable-next-line no-undef
        return System.import(specifier)
      },
      {
        specifier: mainRelativePath,
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

  const content = await fileRead(SYSTEM_PATH)

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
  serveFile(fileUrlToPath(resolveFileUrl(ressource.slice(1), testDirectoryUrl)), {
    method,
    headers,
  })
