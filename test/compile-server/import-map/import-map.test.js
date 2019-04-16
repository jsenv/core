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

const response = await fetch(`${compileServer.origin}/${compileInto}/otherwise/importMap.json`)
const actual = await response.json()
const expected = {
  imports: {
    "/foo": "/.dist/otherwise/foo.js",
  },
  scopes: {
    "/.dist/otherwise/": {
      "/foo": "/.dist/otherwise/foo.js",
      "/.dist/otherwise/": "/.dist/otherwise/",
      "/": "/.dist/otherwise/",
    },
  },
}
assert({ actual, expected })
