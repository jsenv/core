import { existsSync } from "node:fs"
import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_GLOBAL_BUILD_TEST_PARAMS,
  SCRIPT_LOAD_GLOBAL_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_GLOBAL.js"
import { scriptLoadGlobalBuild } from "@jsenv/core/test/scriptLoadGlobalBuild.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/global/`
const mainFilename = `index.js`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.js",
}
await buildProject({
  ...GENERATE_GLOBAL_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
})
const { globalValue, serverOrigin } = await scriptLoadGlobalBuild({
  ...SCRIPT_LOAD_GLOBAL_BUILD_TEST_PARAMS,
  buildDirectoryRelativeUrl,
})

const jsUrlInstanceOfUrl = globalValue.jsUrlInstanceOfUrl
const jsUrl = globalValue.jsUrlString

// it would be great to have an error or at least a warning.
// ! The file must be hashed
// ! The file must be on filesystem
const actual = {
  jsUrlInstanceOfUrl,
  jsUrl,
}
const expected = {
  jsUrlInstanceOfUrl: true,
  jsUrl: String(new URL(`./assets/file-7aa95da0.js`, serverOrigin)),
}
assert({ actual, expected })

{
  const buildDirectoryUrl = resolveUrl(
    buildDirectoryRelativeUrl,
    jsenvCoreDirectoryUrl,
  )
  const jsRelativeUrl = urlToRelativeUrl(jsUrl, serverOrigin)
  const jsBuildUrl = resolveUrl(jsRelativeUrl, buildDirectoryUrl)
  const jsBuildFileExists = existsSync(new URL(jsBuildUrl))
  const actual = jsBuildFileExists
  const expected = true
  assert({ actual, expected })
}
