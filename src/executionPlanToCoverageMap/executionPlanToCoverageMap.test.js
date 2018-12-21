import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { assert } from "@dmail/assert"
import { launchNode } from "../launchNode/index.js"
import { launchChromium } from "../launchChromium/index.js"
import { executionPlanToCoverageMap } from "./executionPlanToCoverageMap.js"
import { localRoot } from "../localRoot.js"
import { createJsCompileService } from "../createJsCompileService.js"
import { open as serverCompileOpen } from "../server-compile/index.js"

const test = async ({ listFilesToCover }) => {
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

  const executionPlan = {
    node: {
      launchPlatform: launchNode,
      files: ["src/__test__/file.test.js"],
    },
    chromium: {
      launchPlatform: launchChromium,
      files: [], // ["src/__test__/file.test.js"]
    },
  }
  const filesToCover = listFilesToCover()
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
}

test()
