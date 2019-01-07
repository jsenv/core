import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { assert } from "@dmail/assert"
import { launchNode } from "../launchNode/index.js"
import { launchChromium } from "../launchChromium/index.js"
import { executionPlanToCoverageMap } from "./executionPlanToCoverageMap.js"
import { localRoot } from "../localRoot.js"
import { createJsCompileService } from "../createJsCompileService.js"
import { open as serverCompileOpen } from "../server-compile/index.js"

process.on("unhandledRejection", (value) => {
  throw value
})

const test = async () => {
  const filesToCover = []
  const compileInto = "build"
  const pluginMap = pluginOptionMapToPluginMap({
    "transform-modules-systemjs": {},
  })

  const jsCompileService = await createJsCompileService({
    localRoot,
    compileInto,
    pluginMap,
  })

  const server = await serverCompileOpen({
    protocol: "http",
    ip: "127.0.0.1",
    port: 0,
    localRoot,
    compileInto,
    compileService: jsCompileService,
  })

  const remoteRoot = server.origin

  const nodeLaunch = () => launchNode({ remoteRoot, localRoot, compileInto })
  const chromiumLaunch = () => launchChromium({ remoteRoot, localRoot, compileInto })

  const executionPlan = {
    "src/__test__/file.test.js": {
      node: {
        launch: nodeLaunch,
      },
      chromium: {
        launch: chromiumLaunch,
      },
    },
  }
  const coverageMap = await executionPlanToCoverageMap(executionPlan, {
    localRoot,
    compileInto,
    filesToCover,
  })

  assert({
    actual: coverageMap["index.js"],
    expected: {
      b: {},
      branchMap: {},
      f: {},
      fnMap: {},
      path: "index.js",
      s: {},
      statementMap: {},
    },
  })
  assert({
    actual: coverageMap["src/__test__/file.js"].s,
    expected: {
      0: 1,
      1: 1,
      2: 1,
    },
  })

  // server.close()
}

test()
