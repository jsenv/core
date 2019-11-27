import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  resolveUrl,
  urlToRelativeUrl,
  fileUrlToPath,
} from "src/internal/urlUtils.js"
import { startCompileServer } from "../../../index.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS.js"
import { fetch } from "../fetch.js"

const compileDirectoryUrl = resolveDirectoryUrl("./.dist", import.meta.url)
const fileUrl = resolveUrl("./syntax-error.js", import.meta.url)
const fileRelativeUrl = urlToRelativeUrl(
  fileUrl,
  COMPILE_SERVER_TEST_PARAMS.projectDirectoryUrl,
)
const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  compileDirectoryUrl,
})
const fileServerUrl = `${compileServer.origin}/.dist/otherwise/${fileRelativeUrl}`

const response = await fetch(fileServerUrl)
const body = await response.json()
const actual = {
  status: response.status,
  statusText: response.statusText,
  headers: response.headers,
  body,
}
const expected = {
  status: 500,
  statusText: "parse error",
  headers: {
    ...actual.headers,
    "cache-control": ["no-store"],
    "content-type": ["application/json"],
  },
  body: {
    message: actual.body.message,
    messageHTML: actual.body.messageHTML,
    filename: fileUrlToPath(fileUrl),
    lineNumber: 1,
    columnNumber: 11,
  },
}
assert({ actual, expected })
