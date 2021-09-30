import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { buildProject, commonJsToJavaScriptModule } from "@jsenv/core"
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
const mainFilename = `importing_react.html`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.html",
}

const { buildMappings } = await buildProject({
  ...GENERATE_GLOBAL_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
  customCompilers: {
    "./node_modules/react/index.js": (options) =>
      commonJsToJavaScriptModule({
        ...options,
        processEnvNodeEnv: "dev",
      }),
  },
})
const mainJsFileBuildRelativeUrl =
  buildMappings[`${testDirectoryRelativeUrl}importing_react.js`]
const { globalValue } = await scriptLoadGlobalBuild({
  ...SCRIPT_LOAD_GLOBAL_BUILD_TEST_PARAMS,
  buildDirectoryRelativeUrl,
  mainRelativeUrl: `./${mainJsFileBuildRelativeUrl}`,
})

const actual = globalValue
const expected = "object"
assert({ actual, expected })
