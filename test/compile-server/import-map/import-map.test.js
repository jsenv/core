import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { startCompileServer } from "../../../index.js"
import { fetch } from "../fetch.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))

const compileServer = await startCompileServer({
  projectFolder: testFolder,
  verbose: false,
})

const response = await fetch(`${compileServer.origin}/.jsenv/importMap.json`)
const actual = await response.json()
const expected = {
  imports: {
    "/foo": "/foo.js",
  },
}
assert({ actual, expected })
