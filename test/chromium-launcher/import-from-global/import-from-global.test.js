import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"

const projectFolder = JSENV_PATH
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileInto = `${folderJsenvRelativePath}/.dist`
const fileRelativePath = `${folderJsenvRelativePath}/import-from-global.js`

const { origin: compileServerOrigin } = await startCompileServer({
  projectFolder,
  compileInto,
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
})
const expected = {
  status: "completed",
  namespace: {
    default: 42,
  },
}
assert({ actual, expected })
