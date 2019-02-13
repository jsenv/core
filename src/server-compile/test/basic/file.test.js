import fetch from "node-fetch"
import { assert } from "@dmail/assert"
import { projectFolder } from "../../../projectFolder.js"
import { startCompileServer } from "../../startCompileServer.js"

const test = async () => {
  const compileInto = "build"
  const babelPluginDescription = {}

  const compileServer = await startCompileServer({
    projectFolder,
    compileInto,
    babelPluginDescription,
    protocol: "http",
    ip: "127.0.0.1",
    port: 8998,
  })

  const response = await fetch(
    `${compileServer.origin}/build/best/src/server-compile/test/basic/file.js`,
  )
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
}

test()
