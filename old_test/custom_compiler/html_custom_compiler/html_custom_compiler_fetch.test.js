import { fetchUrl } from "@jsenv/server"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { startCompileServer } from "@jsenv/core/src/internal/compile_server/compile_server.js"
import {
  findHtmlNodeById,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"
import { COMPILE_SERVER_TEST_PARAMS } from "@jsenv/core/test/__internal__/compile_server/TEST_PARAMS_COMPILE_SERVER.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const fileRelativeUrl = `${testDirectoryRelativeUrl}main.html`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`

let callCount = 0
const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  customCompilers: {
    [`${testDirectoryRelativeUrl}main.html`]: ({ request, content }) => {
      const htmlWithAnswer = content.replace(
        /__data_from_server__/,
        JSON.stringify({
          answer: 42,
        }),
      )
      callCount++
      return {
        contentType: "text/html",
        content: htmlWithAnswer,
        responseHeaders: {
          "x-request-user-agent": request.headers["user-agent"],
          "cache-control": "no-store",
        },
      }
    },
  },
})
const { compileId } = await compileServer.createCompileIdFromRuntimeReport({})
const compiledFileRelativeUrl = `${compileServer.jsenvDirectoryRelativeUrl}${compileId}/${fileRelativeUrl}?t=1`
const fileServerUrl = `${compileServer.origin}/${compiledFileRelativeUrl}`

// content correctly inlined in the HTML file
{
  const response = await fetchUrl(fileServerUrl, {
    ignoreHttpsError: true,
    headers: {
      "user-agent": "jsenv-test",
    },
  })
  const responseBodyAsText = await response.text()
  const scriptInline = findHtmlNodeById(responseBodyAsText, "inline")
  const scriptContent = getHtmlNodeTextNode(scriptInline).value
  global.window = {}
  // eslint-disable-next-line no-eval
  eval(scriptContent)

  const actual = {
    status: response.status,
    contentType: response.headers.get("content-type"),
    xRequestUserAgent: response.headers.get("x-request-user-agent"),
    window: global.window,
  }
  const expected = {
    status: 200,
    contentType: "text/html",
    xRequestUserAgent: "jsenv-test",
    window: {
      __DATA_FROM_SERVER__: { answer: 42 },
    },
  }
  assert({ actual, expected })
}

// There is no cache
{
  await fetchUrl(fileServerUrl, {
    ignoreHttpsError: true,
  })
  const actual = {
    callCount,
  }
  const expected = {
    callCount: 2,
  }
  assert({ actual, expected })
}
