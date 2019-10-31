import { assert } from "@dmail/assert"
import { fileHrefToFolderRelativePath } from "../../fileHrefToFolderRelativePath.js"
import { startCompileServer, STOP_REASON_PACKAGE_VERSION_CHANGED } from "../../../index.js"
import { COMPILE_SERVER_TEST_PARAM } from "../../compile-server-test-param.js"

const folderRelativePath = fileHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`

const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAM,
  compileIntoRelativePath,
  stopOnPackageVersionChange: true,
})
// TODO: change this for something updating package.json version
compileServer.stop(STOP_REASON_PACKAGE_VERSION_CHANGED)
const reason = await compileServer.stoppedPromise

const actual = reason
const expected = STOP_REASON_PACKAGE_VERSION_CHANGED
assert({ actual, expected })
