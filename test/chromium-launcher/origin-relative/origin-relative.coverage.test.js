import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"
import { createInstrumentPlugin } from "../../../src/cover/createInstrumentPlugin.js"
import { removeFolder } from "../removeFolder.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const projectFolder = JSENV_PATH
const compileInto = `${folderJsenvRelativePath}/.dist`
const fileRelativePath = `${folderJsenvRelativePath}/origin-relative.js`
const babelConfigMap = {
  "transform-instrument": [
    createInstrumentPlugin({
      predicate: (filename) => {
        return filename === `${folderJsenvRelativePath}/file.js`
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
  fileRelativePath,
  collectNamespace: true,
  collectCoverage: true,
})
const expected = {
  status: "completed",
  namespace: {
    default: 42,
  },
  coverageMap: {
    [`${folderJsenvRelativePath}/file.js`]: actual.coverageMap[
      `${folderJsenvRelativePath}/file.js`
    ],
  },
}
assert({
  actual,
  expected,
})
