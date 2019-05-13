import { assert } from "@dmail/assert"
import { hrefToFolderJsenvRelative } from "../../../src/hrefToFolderJsenvRelative.js"
import { ROOT_FOLDER } from "../../../src/ROOT_FOLDER.js"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"

const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const projectFolder = ROOT_FOLDER
const compileInto = `${testFolderRelative}/.dist`
const filenameRelative = `${testFolderRelative}/import-from-global.js`

const { origin: compileServerOrigin } = await startCompileServer({
  projectFolder,
  compileInto,
  verbose: false,
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
})
const expected = {
  status: "completed",
  namespace: {
    default: 42,
  },
}
assert({ actual, expected })
