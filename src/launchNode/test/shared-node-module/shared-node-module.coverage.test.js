import { assert } from "@dmail/assert"
import { projectFolder } from "../../../../projectFolder.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchNode } from "../../launchNode.js"

const testFolder = `${projectFolder}/src/launchNode/test/shared-node-module`
const filenameRelative = `shared-node-module.js`
const compileInto = ".dist"
const babelPluginDescription = {}

;(async () => {
  const sourceOrigin = `file://${testFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder: testFolder,
    compileInto,
    babelPluginDescription,
  })

  const actual = await launchAndExecute({
    launch: (options) => launchNode({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
    collectNamespace: true,
    collectCoverage: true,
    filenameRelative,
    verbose: true,
  })
  const expected = {
    status: "completed",
    namespace: { foo: "foo" },
    coverageMap: {
      "node_modules/foo/foo.js": actual.coverageMap["node_modules/foo/foo.js"],
      "node_modules/use-shared-foo/use-shared-foo.js":
        actual.coverageMap["node_modules/use-shared-foo/use-shared-foo.js"],
      "shared-node-module.js": actual.coverageMap["shared-node-module.js"],
    },
  }
  assert({
    actual,
    expected,
  })
})()
