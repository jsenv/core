import { assert } from "@jsenv/assert"
import {
  resolveUrl,
  resolveDirectoryUrl,
  urlToRelativeUrl,
  urlToFileSystemPath,
} from "@jsenv/filesystem"

import { launchNode } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { launchAndExecute } from "@jsenv/core/src/internal/executing/launchAndExecute.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  LAUNCH_AND_EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_NODE.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const mainFilename = `import_not_found.js`
const mainFileRelativeUrl = `${testDirectoryRelativeUrl}${mainFilename}`
const importerFileRelativeUrl = "intermediate.js"
const { origin: compileServerOrigin, outDirectoryRelativeUrl } =
  await startCompileServer({
    ...START_COMPILE_SERVER_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
  })
const importerFileUrl = resolveUrl(importerFileRelativeUrl, testDirectoryUrl)
const importedFileUrl = resolveUrl("foo.js", testDirectoryUrl)

const actual = await launchAndExecute({
  ...LAUNCH_AND_EXECUTE_TEST_PARAMS,
  launchAndExecuteLogLevel: "off",
  launch: (options) =>
    launchNode({
      ...LAUNCH_TEST_PARAMS,
      ...options,
      outDirectoryRelativeUrl,
      compileServerOrigin,
    }),
  executeParams: {
    fileRelativeUrl: mainFileRelativeUrl,
  },
})
const expected = {
  status: "errored",
  error: Object.assign(
    new Error(
      `Cannot find module '${urlToFileSystemPath(
        importedFileUrl,
      )}' imported from ${urlToFileSystemPath(importerFileUrl)}`,
    ),
    {
      code: "ERR_MODULE_NOT_FOUND",
    },
  ),
}
assert({ actual, expected })
