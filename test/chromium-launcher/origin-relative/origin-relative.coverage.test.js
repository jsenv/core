import { assert } from "@dmail/assert"
import { hrefToFolderJsenvRelative } from "../../../src/hrefToFolderJsenvRelative.js"
import { ROOT_FOLDER } from "../../../src/ROOT_FOLDER.js"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"
import { createInstrumentPlugin } from "../../../src/cover/createInstrumentPlugin.js"
import { removeFolder } from "../removeFolder.js"

const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const projectFolder = ROOT_FOLDER
const compileInto = `${testFolderRelative}/.dist`
const filenameRelative = `${testFolderRelative}/origin-relative.js`
const babelConfigMap = {
  "transform-instrument": [
    createInstrumentPlugin({
      predicate: (filename) => {
        return filename === `${testFolderRelative}/file.js`
      },
    }),
  ],
}

await removeFolder(`${projectFolder}/${compileInto}`)

const { origin: compileServerOrigin } = await startCompileServer({
  projectFolder,
  compileInto,
  babelConfigMap,
  logLevel: "off",
})

const actual = await launchAndExecute({
  launch: (options) =>
    launchChromium({
      ...options,
      projectFolder,
      compileInto,
      compileServerOrigin,
    }),
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
    [`${testFolderRelative}/file.js`]: actual.coverageMap[`${testFolderRelative}/file.js`],
  },
}
assert({
  actual,
  expected,
})
