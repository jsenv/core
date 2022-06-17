import { writeFile, ensureEmptyDirectory } from "@jsenv/filesystem"

import { startServer, fetchUrl } from "@jsenv/server"

const htmlFilesDirectoryUrl = new URL("./snapshots/", import.meta.url).href

// we need a deterministic stack trace, otherwise
// test would fail in CI
const deterministicStackTrace = `Error: test
    at requestToResponse (file:///Users/d.maillard/Dev/Github/jsenv-server/test/startServer/internal-error/generate-internal-error-html-files.js:45:19)
    at generateResponseDescription (file:///Users/d.maillard/Dev/Github/jsenv-server/src/startServer.js:456:42)
    at file:///Users/d.maillard/Dev/Github/jsenv-server/src/startServer.js:302:64
    at timeFunction (file:///Users/d.maillard/Dev/Github/jsenv-server/src/serverTiming.js:19:23)
    at Server.requestCallback (file:///Users/d.maillard/Dev/Github/jsenv-server/src/startServer.js:302:17)
    at Server.emit (events.js:326:22)
    at parserOnIncoming (_http_server.js:777:12)
    at HTTPParser.parserOnHeadersComplete (_http_common.js:119:17)`

const generateInternalErrorHtmlFile = async (htmlFilename, serverParams) => {
  const { origin, stop } = await startServer({
    logLevel: "off",
    protocol: "http",
    keepProcessAlive: false,
    ...serverParams,
  })
  {
    const response = await fetchUrl(origin, {
      headers: {
        accept: "text/html",
      },
    })
    stop()
    const htmlFileUrl = new URL(htmlFilename, htmlFilesDirectoryUrl).href
    await writeFile(htmlFileUrl, await response.text())
  }
}

await ensureEmptyDirectory(htmlFilesDirectoryUrl)

await generateInternalErrorHtmlFile("basic.html", {
  requestToResponse: () => {
    const error = new Error("test")
    throw error
  },
})

await generateInternalErrorHtmlFile("basic_with_details.html", {
  requestToResponse: () => {
    const error = new Error("test")
    error.stack = deterministicStackTrace
    throw error
  },
  sendErrorDetails: true,
})

// only error.stack is shown in the html page.
// any extra property (like error.code) are not available.
// maybe we want to have extra properties as well ?
// I let the test below to keep this in mind
await generateInternalErrorHtmlFile("basic_with_code_and_details.html", {
  requestToResponse: () => {
    const error = new Error("test")
    error.code = "TEST_CODE"
    error.stack = deterministicStackTrace
    throw error
  },
  sendErrorDetails: true,
})

await generateInternalErrorHtmlFile("literal.html", {
  requestToResponse: () => {
    const error = "a string"
    throw error
  },
})

await generateInternalErrorHtmlFile("literal_with_details.html", {
  requestToResponse: () => {
    const error = "a string"
    throw error
  },
  sendErrorDetails: true,
})
