import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { fileRead } from "@dmail/helper"
import { assert } from "@dmail/assert"
import { startCompileServer } from "../../../index.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const compileInto = ".dist"
const babelConfigMap = { "transform-block-scoping": true }

const importMap = {
  imports: {
    "/foo": "/foo.js",
  },
}
const compileServer = await startCompileServer({
  importMap,
  projectFolder: testFolder,
  compileInto,
  babelConfigMap,
  compileGroupCount: 2,
  protocol: "http",
  ip: "127.0.0.1",
  port: 8998,
})
compileServer.stop()

const content = await fileRead(`${testFolder}/${compileInto}/importMap.otherwise.json`)
const actual = JSON.parse(content)
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
