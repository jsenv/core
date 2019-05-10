import { assert } from "@dmail/assert"
import { hrefToFolderJsenvRelative } from "../../../../src/hrefToFolderJsenvRelative.js"
import { ROOT_FOLDER } from "../../../../src/ROOT_FOLDER.js"
import { startCompileServer, launchAndExecute, launchNode } from "../../../../index.js"

const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const projectFolder = ROOT_FOLDER
const compileInto = `${testFolderRelative}/.dist`
const filenameRelative = `${testFolderRelative}/symlink.js`

const { origin: compileServerOrigin } = await startCompileServer({
  projectFolder,
  compileInto,
  verbose: false,
})

const actual = await launchAndExecute({
  launch: (options) => launchNode({ ...options, projectFolder, compileServerOrigin, compileInto }),
  verbose: false,
  filenameRelative,
  collectNamespace: true,
})
const expected = {
  status: "completed",
  namespace: {
    default: "foo",
  },
}
assert({ actual, expected })
