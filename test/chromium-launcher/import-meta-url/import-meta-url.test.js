import { assert } from "@dmail/assert"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"

const projectFolder = JSENV_PATH
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`
const fileRelativePath = `${folderJsenvRelativePath}/import-meta-url.js`

const { origin: compileServerOrigin } = await startCompileServer({
  projectFolder,
  compileIntoRelativePath,
  logLevel: "off",
})

const actual = await launchAndExecute({
  launch: (options) =>
    launchChromium({
      ...options,
      compileServerOrigin,
      projectFolder,
      compileIntoRelativePath,
    }),
  stopOnceExecuted: true,
  mirrorConsole: true,
  fileRelativePath,
  collectNamespace: true,
})
const expected = {
  status: "completed",
  namespace: {
    default: `${compileServerOrigin}${fileRelativePath}`,
  },
}
assert({ actual, expected })
