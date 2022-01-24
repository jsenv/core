import { fetchUrl } from "@jsenv/server"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import {
  findNodeByTagName,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"

import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS_COMPILE_SERVER.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}importmap_force_inline.html`
// const fileUrl = resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl)

const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})
const fileServerUrl = `${compileServer.origin}/${fileRelativeUrl}`
const response = await fetchUrl(fileServerUrl, { ignoreHttpsError: true })
const responseBodyAsText = await response.text()
const importmapScriptNode = findNodeByTagName(responseBodyAsText, "script")
const importmapScriptContent = getHtmlNodeTextNode(importmapScriptNode).value
const importmapScriptContentAsJSON = JSON.parse(importmapScriptContent)

const actual = {
  status: response.status,
  statusText: response.statusText,
  contentType: response.headers.get("content-type"),
  importmapScriptContentAsJSON,
}
const expected = {
  status: 200,
  statusText: "OK",
  contentType: "text/html",
  importmapScriptContentAsJSON: {
    imports: {
      "./asset/file.js": "./asset/file-mapped.js",
    },
  },
}
assert({ actual, expected })
