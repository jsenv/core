import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { startCompileServer } from "../../../index.js"
import { fetch } from "../fetch.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const compileInto = ".dist"

const compileServer = await startCompileServer({
  projectFolder: testFolder,
  verbose: false,
})

const response = await fetch(`${compileServer.origin}/${compileInto}/otherwise/syntax-error.js`)
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
    messageHTML: actual.body.messageHTML,
    filename: `${testFolder}/syntax-error.js`,
    href: `${compileServer.origin}/${compileInto}/otherwise/syntax-error.js`,
    lineNumber: 1,
    columnNumber: 11,
  },
}

assert({
  actual,
  expected,
})
