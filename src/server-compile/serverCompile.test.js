import fetch from "node-fetch"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { assert } from "@dmail/assert"
import { localRoot } from "../localRoot.js"
import { createJsCompileService } from "../createJsCompileService.js"
import { open } from "./serverCompile.js"

const test = async () => {
  const compileInto = "build"
  const pluginMap = pluginOptionMapToPluginMap({
    "transform-modules-systemjs": {},
  })

  const compileService = await createJsCompileService({
    pluginMap,
    localRoot,
    compileInto,
  })

  const server = await open({
    localRoot,
    compileService,
    protocol: "http",
    ip: "127.0.0.1",
    port: 8998,
  })

  const response = await fetch(`${server.origin}/build/best/src/__test__/file.js`)

  assert({
    actual: response.status,
    expected: 200,
  })

  server.close()
}

test()
