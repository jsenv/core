import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { launchAndExecute, startCompileServer, launchChromium } from "../../../index.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const filenameRelative = `folder/file.js`
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
  launch: (options) =>
    launchChromium({
      ...options,
      sourceOrigin,
      compileInto,
      compileServerOrigin,

    }),
  verbose: false,
  stopOnceExecuted: true,
  filenameRelative,
  collectNamespace: true,
  collectCoverage: true,
})
const expected = {
  status: "completed",
  namespace: {
    default: 42,
  },
  coverageMap: {
    "/absolute-import.js": actual.coverageMap["absolute-import.js"],
    "/dependency.js": actual.coverageMap["/dependency.js"],
  },
}
assert({ actual, expected })
