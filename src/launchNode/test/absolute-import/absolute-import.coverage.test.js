import { assert } from "@dmail/assert"
import { projectFolder } from "../../../../projectFolder.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchNode } from "../../launchNode.js"
import {
  coverageMapToAbsolute,
  coverageMapLog,
  coverageMapHTML,
} from "../../../executionPlanResultToCoverageMap/index.js"

const filenameRelative = `src/launchNode/test/absolute-import/absolute-import.js`
const compileInto = "build"
const babelPluginDescription = {}

;(async () => {
  const sourceOrigin = `file://${projectFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder,
    compileInto,
    babelPluginDescription,
  })

  const actual = await launchAndExecute({
    launch: (options) => launchNode({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
    collectNamespace: true,
    collectCoverage: true,
    filenameRelative,
    verbose: true,
    platformTypeForLog: "node process",
  })
  const expected = {
    status: "completed",
    namespace: {
      default: 42,
    },
    coverageMap: {
      "src/launchNode/test/absolute-import/absolute-import.js":
        actual.coverageMap["src/launchNode/test/absolute-import/absolute-import.js"],
      "src/launchNode/test/absolute-import/dependency.js":
        actual.coverageMap["src/launchNode/test/absolute-import/dependency.js"],
    },
  }
  assert({
    actual,
    expected,
  })

  const absoluteCoverageMap = coverageMapToAbsolute(actual.coverageMap, projectFolder)
  coverageMapLog(absoluteCoverageMap)
  coverageMapHTML(absoluteCoverageMap)
})()
