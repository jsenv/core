import { assert } from "@dmail/assert"
import { root } from "../../../root.js"
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
const babelPluginDescription = {}

;(async () => {
  const { origin: remoteRoot } = await startCompileServer({
    root,
    compileInto,
    babelPluginDescription,
  })

  const actual = await launchAndExecute({
    launch: (options) => launchNode({ ...options, root, compileInto, remoteRoot }),
    collectNamespace: true,
    collectCoverage: true,
    file,
    verbose: true,
    platformTypeForLog: "node process",
  })
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
