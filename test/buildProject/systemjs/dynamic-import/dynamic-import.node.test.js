import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { buildProject } from "@jsenv/core/index.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { nodeImportSystemJsBuild } from "../nodeImportSystemJsBuild.js"
import {
  GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `${testDirectoryname}.js`

const firstBuild = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  useImportMapToImproveLongTermCaching: false,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.js",
  },
})
const { namespace: actual } = await nodeImportSystemJsBuild({
  ...IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
  testDirectoryRelativeUrl,
})
const expected = {
  default: 42,
}
assert({ actual, expected })

// ensure file hash does not change when runned twice
{
  const secondBuild = await buildProject({
    ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
    useImportMapToImproveLongTermCaching: false,
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPointMap: {
      [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.js",
    },
  })
  const actual = secondBuild.buildMappings
  const expected = firstBuild.buildMappings
  assert({ actual, expected })
}
