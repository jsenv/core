import { chromium } from "playwright"
import { startServer, composeServices, fetchFileSystem } from "@jsenv/server"
import { resolveUrl } from "@jsenv/filesystem"

export const executeInBrowser = async ({
  directoryUrl,
  htmlFileRelativeUrl,
  headScriptUrl,
  pageFunction,
  pageArguments = [],
  debug = false,
  headless = !debug,
  autoStop = !debug,
}) => {
  const [server, browser] = await Promise.all([
    startFileServer({ directoryUrl }),
    chromium.launch({
      headless,
    }),
  ])
  const page = await browser.newPage({ ignoreHTTPSErrors: true })
  await page.goto(resolveUrl(htmlFileRelativeUrl, server.origin))
  if (headScriptUrl) {
    // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pageaddscripttagoptions
    await page.addScriptTag({
      url: headScriptUrl,
    })
  }
  try {
    const returnValue = await page.evaluate(pageFunction, ...pageArguments)
    return {
      returnValue,
      serverOrigin: server.origin,
    }
  } finally {
    if (autoStop) {
      browser.close()
      server.stop()
    }
  }
}

const startFileServer = ({ directoryUrl }) => {
  return startServer({
    logLevel: "error",
    protocol: "http",
    requestToResponse: composeServices({
      static: (request) =>
        fetchFileSystem(new URL(request.ressource.slice(1), directoryUrl), {
          headers: request.headers,
        }),
    }),
  })
}
