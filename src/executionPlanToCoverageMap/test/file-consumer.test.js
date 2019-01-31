import { assert } from "@dmail/assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { launchNode } from "../../launchNode/index.js"
import { launchChromium } from "../../launchChromium/index.js"
import { executionPlanToCoverageMap } from "../executionPlanToCoverageMap.js"
import { localRoot } from "../../localRoot.js"
import { startCompileServer } from "../../server-compile/index.js"

const filesToCover = []
const compileInto = "build"
const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
})

;(async () => {
  const { origin: remoteRoot } = await startCompileServer({
    localRoot,
    compileInto,
    pluginMap,
    protocol: "http",
    ip: "127.0.0.1",
    port: 0,
    verbose: false,
  })

  const nodeLaunch = () => launchNode({ remoteRoot, localRoot, compileInto })
  const chromiumLaunch = () => launchChromium({ remoteRoot, localRoot, compileInto })

  const executionPlan = {
    "src/executionPlanToCoverageMap/test/fixtures/file-consumer.js": {
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
    actual: coverageMap,
    expected: {
      "src/executionPlanToCoverageMap/test/fixtures/file.js": {
        ...coverageMap["src/executionPlanToCoverageMap/test/fixtures/file.js"],
        s: { 0: 2, 1: 2, 2: 2 },
      },
      // il ne faut pas de coverage pour file-consumer.js
    },
  })
})()
