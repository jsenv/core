import { assert } from "@jsenv/assert"
import {
  resolveUrl,
  resolveDirectoryUrl,
  urlToRelativeUrl,
  urlToFileSystemPath,
} from "@jsenv/filesystem"

import { execute, nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  EXECUTE_TEST_PARAMS,
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
const importerFileUrl = resolveUrl(importerFileRelativeUrl, testDirectoryUrl)
const importedFileUrl = resolveUrl("foo.js", testDirectoryUrl)

const actual = await execute({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  launchAndExecuteLogLevel: "off",
  runtime: nodeRuntime,
  runtimeParams: {
    ...LAUNCH_TEST_PARAMS,
  },
  fileRelativeUrl: mainFileRelativeUrl,
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
