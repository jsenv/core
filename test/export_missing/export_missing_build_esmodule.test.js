import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

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
const mainFilename = `export_missing.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${mainFilename}`
const entryPointMap = {
  [`./${fileRelativeUrl}`]: "./main.js",
}
const importerFileUrl = resolveUrl(mainFilename, testDirectoryUrl)
const importedFileUrl = resolveUrl("file.js", testDirectoryUrl)

try {
  await buildProject({
    ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPointMap,
  })
  throw new Error("should throw")
} catch (e) {
  const actual = e.message
  const expected = `'answer' is not exported by ${importedFileUrl}, imported by ${importerFileUrl}
--- frame ---
1: // eslint-disable-next-line import/named
2: import { answer } from "./file.js";
            ^
3: console.log(answer);
4: //# sourceMappingURL=export_missing.js.map`
  assert({ actual, expected })
}
