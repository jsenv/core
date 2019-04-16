import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { startCompileServer } from "../../../index.js"
import { fetch } from "../fetch.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const compileInto = ".dist"

const compileServer = await startCompileServer({
  projectFolder: testFolder,
  verbose: true,
})

const response = await fetch(`${compileServer.origin}/${compileInto}/JSENV_BROWSER_CLIENT.js`)
debugger
const actual = {
  status: response.status,
  statusText: response.statusText,
  headers: response.headers,
}
const expected = {
  status: 200,
  statusText: "OK",
  headers: {
    ...actual.headers,
    "access-control-allow-credentials": ["true"],
    "access-control-allow-headers": ["x-requested-with, content-type, accept"],
    "access-control-allow-methods": ["GET, POST, PUT, DELETE, OPTIONS"],
    "access-control-allow-origin": ["*"],
    "access-control-max-age": ["1"],
    connection: ["close"],
    "content-type": ["application/javascript"],
  },
}

assert({
  actual,
  expected,
})
