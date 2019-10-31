import { assert } from "@dmail/assert"
import {
  operatingSystemPathToPathname,
  pathnameToOperatingSystemPath,
} from "@jsenv/operating-system-path"
import { jsenvCompileServerPath } from "../../../src/jsenvCompileServerPath.js"
import { fileHrefToFolderRelativePath } from "../../fileHrefToFolderRelativePath.js"
import { startCompileServer } from "../../../index.js"
import { COMPILE_SERVER_TEST_PARAM } from "../../compile-server-test-param.js"
import { fetch } from "../../fetch.js"

const folderRelativePath = fileHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`
const compileId = "otherwise"
const fileRelativePath = `${folderRelativePath}/syntax-error.js`

const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAM,
  compileIntoRelativePath,
})

const response = await fetch(
  `${compileServer.origin}${compileIntoRelativePath}/${compileId}${fileRelativePath}`,
)
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
    filename: pathnameToOperatingSystemPath(
      `${operatingSystemPathToPathname(jsenvCompileServerPath)}${fileRelativePath}`,
    ),
    lineNumber: 1,
    columnNumber: 11,
  },
}
assert({ actual, expected })
