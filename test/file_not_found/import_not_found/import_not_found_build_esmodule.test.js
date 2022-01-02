import { assert } from "@jsenv/assert"
import {
  resolveUrl,
  urlToRelativeUrl,
  urlToFileSystemPath,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const mainFilename = `import_not_found.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${mainFilename}`
const mainFileUrl = resolveUrl(mainFilename, import.meta.url)
const intermediateFileUrl = resolveUrl("./intermediate.js", import.meta.url)
const fooFileUrl = resolveUrl("foo.js", import.meta.url)

try {
  await buildProject({
    ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPointMap: {
      [`./${fileRelativeUrl}`]: "main.js",
    },
  })
  throw new Error("should throw")
} catch (e) {
  const actual = e.message
  const expected = `invalid response status on url
--- response status ---
404
--- url ---
${fooFileUrl}
--- url trace ---
${urlToFileSystemPath(intermediateFileUrl)}
  imported by ${urlToFileSystemPath(mainFileUrl)}
  imported by ${urlToFileSystemPath(jsenvCoreDirectoryUrl)}`
  assert({ actual, expected })
}
