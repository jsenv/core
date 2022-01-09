import { existsSync } from "node:fs"
import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_GLOBAL_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_GLOBAL.js"
import { executeFileUsingBrowserScript } from "@jsenv/core/test/execution_with_browser_script.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/global/`
await buildProject({
  ...GENERATE_GLOBAL_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl: `${testDirectoryRelativeUrl}.jsenv/`,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}index.js`]: "main.js",
  },
})
const { globalValue, serverOrigin } = await executeFileUsingBrowserScript({
  buildDirectoryUrl: resolveUrl(
    buildDirectoryRelativeUrl,
    jsenvCoreDirectoryUrl,
  ),
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
  jsUrl: String(new URL(`./assets/file_7aa95da0.js`, serverOrigin)),
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
