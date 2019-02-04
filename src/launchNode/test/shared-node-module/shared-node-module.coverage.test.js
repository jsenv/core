import { assert } from "@dmail/assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot } from "../../../localRoot.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchNode } from "../../launchNode.js"
import {
  coverageMapToAbsolute,
  coverageMapLog,
  coverageMapHTML,
} from "../../../executionPlanToCoverageMap/index.js"

const file = `src/launchNode/test/shared-node-module/shared-node-module.js`
const compileInto = "build"
const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
})

;(async () => {
  const { origin: remoteRoot } = await startCompileServer({
    localRoot,
    compileInto,
    pluginMap,
  })

  const actual = await launchAndExecute(
    () => launchNode({ localRoot, remoteRoot, compileInto }),
    file,
    {
      platformTypeForLog: "node process",
      verbose: true,
      collectNamespace: true,
      collectCoverage: true,
    },
  )
  const expected = {
    status: "completed",
    namespace: { foo: "foo" },
    coverageMap: {
      "src/launchNode/test/shared-node-module/node_modules/foo/foo.js":
        actual.coverageMap["src/launchNode/test/shared-node-module/node_modules/foo/foo.js"],
      "src/launchNode/test/shared-node-module/node_modules/use-shared-foo/use-shared-foo.js":
        actual.coverageMap[
          "src/launchNode/test/shared-node-module/node_modules/use-shared-foo/use-shared-foo.js"
        ],
      "src/launchNode/test/shared-node-module/shared-node-module.js":
        actual.coverageMap["src/launchNode/test/shared-node-module/shared-node-module.js"],
    },
  }
  assert({
    actual,
    expected,
  })

  const absoluteCoverageMap = coverageMapToAbsolute(actual.coverageMap, localRoot)
  coverageMapLog(absoluteCoverageMap)
  coverageMapHTML(absoluteCoverageMap)
})()
