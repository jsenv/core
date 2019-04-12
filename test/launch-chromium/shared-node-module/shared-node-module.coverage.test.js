import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const filenameRelative = `shared-node-module.js`
const compileInto = ".dist"
const babelConfigMap = {}

const sourceOrigin = `file://${testFolder}`

const { origin: compileServerOrigin } = await startCompileServer({
  verbose: false,
  projectFolder: testFolder,
  compileInto,
  babelConfigMap,
})

const actual = await launchAndExecute({
  launch: () => launchChromium({ compileInto, sourceOrigin, compileServerOrigin, headless: false }),
  stopOnceExecuted: true,
  collectNamespace: true,
  collectCoverage: true,
  filenameRelative,
  verbose: false,
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

// const absoluteCoverageMap = coverageMapToAbsolute(actual.coverageMap, localRoot)
// coverageMapLog(absoluteCoverageMap)
// coverageMapHTML(absoluteCoverageMap)
