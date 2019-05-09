import { assert } from "@dmail/assert"
import { ROOT_FOLDER } from "../../../src/ROOT_FOLDER.js"
import { hrefToFolderJsenvRelative } from "../../../src/hrefToFolderJsenvRelative.js"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"

const projectFolder = ROOT_FOLDER
const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const compileInto = `${testFolderRelative}/.dist`
const filenameRelative = `${testFolderRelative}/log.js`

const { origin: compileServerOrigin } = await startCompileServer({
  projectFolder,
  compileInto,
  verbose: true,
})

const actual = await launchAndExecute({
  launch: (options) =>
    launchChromium({
      ...options,
      projectFolder,
      compileInto,
      compileServerOrigin,
      verbose: true,
    }),
  stopOnceExecuted: true,
  captureConsole: true,
  filenameRelative,
  verbose: true,
})
const expected = {
  status: "completed",
  platformLog: `foo
bar
`,
}
assert({ actual, expected })
