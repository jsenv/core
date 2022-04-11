import { chromium } from "playwright"
import { startServer, composeServices, fetchFileSystem } from "@jsenv/server"

export const executeInChromium = async ({
  rootDirectoryUrl,
  htmlFileRelativeUrl,
  headScriptUrl,
  pageFunction,
  pageArguments = [],
  debug = false,
  headless = !debug,
  autoStop = !debug,
}) => {
  const [server, browser] = await Promise.all([
    startFileServer({ rootDirectoryUrl }),
    chromium.launch({
      headless,
    }),
  ])
  const page = await browser.newPage({ ignoreHTTPSErrors: true })
  await page.goto(new URL(htmlFileRelativeUrl, `${server.origin}/`).href)
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

const startFileServer = ({ rootDirectoryUrl }) => {
  return startServer({
    logLevel: "error",
    protocol: "http",
    requestToResponse: composeServices({
      static: (request) =>
        fetchFileSystem(new URL(request.ressource.slice(1), rootDirectoryUrl), {
          headers: request.headers,
        }),
    }),
  })
}
