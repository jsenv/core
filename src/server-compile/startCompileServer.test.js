import fetch from "node-fetch"
import { assert } from "@dmail/assert"
import { rootname } from "../rootname.js"
import { startCompileServer } from "./startCompileServer.js"

const test = async () => {
  const compileInto = "build"
  const pluginMap = {}

  const compileServer = await startCompileServer({
    rootname,
    compileInto,
    pluginMap,
    protocol: "http",
    ip: "127.0.0.1",
    port: 8998,
  })

  const response = await fetch(`${compileServer.origin}/build/best/src/__test__/file.js`)

  assert({
    actual: {
      status: response.status,
      // { ... } because response.headers.raw() an object create with Object.create(null)
      headers: { ...response.headers.raw() },
    },
    expected: {
      status: 200,
      headers: {
        "access-control-allow-credentials": ["true"],
        "access-control-allow-headers": ["x-requested-with, content-type, accept"],
        "access-control-allow-methods": ["GET, POST, PUT, DELETE, OPTIONS"],
        "access-control-allow-origin": ["*"],
        "access-control-max-age": ["1"],
        connection: ["close"],
        "content-length": ["310"],
        "content-type": ["application/javascript"],
        date: [response.headers.get("date")],
        etag: [`"136-GIFV9GrTzr7XuulsY3J7DuWtAT4"`],
      },
    },
  })

  compileServer.stop()
}

test()
