// here I want to test that, when cache, I can change source file
// and cache i invalidated

import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, resolveDirectoryUrl, urlToRelativeUrl, writeFile } from "@jsenv/util"
import { buildProject } from "@jsenv/core/index.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { requireCommonJsBuild } from "../requireCommonJsBuild.js"
import {
  GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativeUrl)
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const mainFilename = `${testDirectoryBasename}.js`
const mainFileRelativeUrl = `${testDirectoryRelativeUrl}${mainFilename}`
const mainFileUrl = resolveUrl(mainFileRelativeUrl, jsenvCoreDirectoryUrl)

const generate = () =>
  buildProject({
    ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
    // logLevel: "debug",
    // compileServerLogLevel: "debug",
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPointMap: {
      [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.cjs",
    },
    filesystemCache: true,
  })

await writeFile(
  mainFileUrl,
  `export const value = 42
`,
)
await generate()
await writeFile(
  mainFileUrl,
  `export const value = 43
`,
)
await generate()

const { namespace: actual } = await requireCommonJsBuild({
  ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
  buildDirectoryRelativeUrl,
})
const expected = { value: 43 }
assert({ actual, expected })
