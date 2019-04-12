import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { startCompileServer } from "../../../index.js"

const fetch = import.meta.require("node-fetch")

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))

const compileInto = ".dist"
const babelConfigMap = { "transform-block-scoping": true }

const compileServer = await startCompileServer({
  projectFolder: testFolder,
  compileInto,
  babelConfigMap,
  compileGroupCount: 2,
  protocol: "http",
  ip: "127.0.0.1",
  port: 8998,
})

const response = await fetch(`${compileServer.origin}/${compileInto}/best/file.js`)
// { ... } because response.headers.raw() an object create with Object.create(null)
const actualHeaders = { ...response.headers.raw() }

assert({
  actual: {
    status: response.status,
    headers: actualHeaders,
  },
  expected: {
    status: 200,
    headers: {
      ...actualHeaders,
      "access-control-allow-credentials": ["true"],
      "access-control-allow-headers": ["x-requested-with, content-type, accept"],
      "access-control-allow-methods": ["GET, POST, PUT, DELETE, OPTIONS"],
      "access-control-allow-origin": ["*"],
      "access-control-max-age": ["1"],
      connection: ["close"],
      "content-type": ["application/javascript"],
    },
  },
})

compileServer.stop()
