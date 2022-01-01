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
const mainFilename = `file_importing_commonjs.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${mainFilename}`
const importerFileUrl = resolveUrl(mainFilename, testDirectoryUrl)
const importedFileUrl = resolveUrl(
  "file_written_in_commonjs.js",
  testDirectoryUrl,
)

try {
  await buildProject({
    ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
    jsConcatenation: false,
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPointMap: {
      [`./${fileRelativeUrl}`]: "main.js",
    },
  })
  throw new Error("should throw")
} catch (e) {
  const actual = e.message
  const expected = `'answer' is not exported by ${urlToFileSystemPath(
    importedFileUrl,
  )}, imported by ${urlToFileSystemPath(importerFileUrl)}
--- frame ---
1: import { answer } from "./file_written_in_commonjs.js";
            ^
2: console.log(answer);
3: //# sourceMappingURL=file_importing_commonjs.js.map
--- suggestion ---
The file seems written in commonjs, you should use "customCompiler" to convert it to js module
{
  "./test/export_missing/export_missing_cjs/file_written_in_commonjs.js": commonJsToJavaScriptModule
}
As documented in https://github.com/jsenv/jsenv-core/blob/master/docs/shared-parameters.md#customcompilers`
  assert({ actual, expected })
}
