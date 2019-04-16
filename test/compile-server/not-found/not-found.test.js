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

const response = await fetch(`${compileServer.origin}/${compileInto}/otherwise/file.js`)
const body = await response.text()
const actual = {
  status: response.status,
  statusText: response.statusText,
  headers: response.headers,
  body,
}
const expected = {
  status: 404,
  statusText: "file not found",
  headers: actual.headers,
  body: "",
}
assert({ actual, expected })
