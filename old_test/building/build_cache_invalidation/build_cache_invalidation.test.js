/*

here I want to test that cache is invalidated when a source file is modified.

*/

import { assert } from "@jsenv/assert"
import {
  resolveUrl,
  resolveDirectoryUrl,
  urlToRelativeUrl,
  writeFile,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import {
  GENERATE_COMMONJS_BUILD_TEST_PARAMS,
  REQUIRE_COMMONJS_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_COMMONJS.js"
import { requireCommonJsBuild } from "@jsenv/core/test/requireCommonJsBuild.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const mainFilename = `main.js`
const mainFileRelativeUrl = `${testDirectoryRelativeUrl}${mainFilename}`
const mainFileUrl = resolveUrl(mainFileRelativeUrl, jsenvCoreDirectoryUrl)

const generate = () =>
  buildProject({
    ...GENERATE_COMMONJS_BUILD_TEST_PARAMS,
    // logLevel: "debug",
    // logLevel: "debug",
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPoints: {
      [`./${testDirectoryRelativeUrl}${mainFilename}`]: "main.cjs",
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
  ...REQUIRE_COMMONJS_BUILD_TEST_PARAMS,
  buildDirectoryRelativeUrl,
})
const expected = { value: 43 }
assert({ actual, expected })
