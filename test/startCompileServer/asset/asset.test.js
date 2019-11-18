import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, resolveFileUrl, urlToRelativeUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "internal/compiling/startCompileServer.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS.js"
import { fetch } from "../fetch.js"

const compileDirectoryUrl = resolveDirectoryUrl("./.dist", import.meta.url)
const fileUrl = resolveFileUrl("./asset.js", import.meta.url)
const fileRelativeUrl = urlToRelativeUrl(fileUrl, jsenvCoreDirectoryUrl)
const compileDirectoryRelativeUrl = urlToRelativeUrl(compileDirectoryUrl, jsenvCoreDirectoryUrl)
const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  compileDirectoryUrl,
})
const fileServerUrl = `${compileServer.origin}/${compileDirectoryRelativeUrl}otherwise/${fileRelativeUrl}`

await fetch(fileServerUrl)
const response = await fetch(`${fileServerUrl}__asset__/meta.json`)
const body = await response.json()
const actual = {
  status: response.status,
  statusText: response.statusText,
  headers: response.headers,
  body,
}
const expected = {
  status: 200,
  statusText: "OK",
  headers: {
    ...actual.headers,
    "content-type": ["application/json"],
  },
  body: {
    originalFileRelativeUrl: fileRelativeUrl,
    contentType: "application/javascript",
    sources: [fileRelativeUrl],
    sourcesEtag: ['"7c-b5QcrFoIrKrXSr5F415m5RCd6uY"'],
    assets: ["asset.js.map"],
    assetsEtag: ['"f3-55p2vaaelfIcmtI8g+lQFAOt4E8"'],
    createdMs: actual.body.createdMs,
    lastModifiedMs: actual.body.lastModifiedMs,
  },
}

assert({ actual, expected })
