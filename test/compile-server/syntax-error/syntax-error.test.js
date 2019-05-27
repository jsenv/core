import { assert } from "@dmail/assert"
import {
  operatingSystemPathToPathname,
  pathnameToOperatingSystemPath,
} from "@jsenv/operating-system-path"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { startCompileServer } from "../../../index.js"
import { COMPILE_SERVER_TEST_PARAM } from "../compile-server-test-param.js"
import { fetch } from "../fetch.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`
const compileId = "otherwise"
const fileRelativePath = `${folderJsenvRelativePath}/syntax-error.js`

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
      `${operatingSystemPathToPathname(JSENV_PATH)}${fileRelativePath}`,
    ),
    lineNumber: 1,
    columnNumber: 11,
  },
}

assert({
  actual,
  expected,
})
