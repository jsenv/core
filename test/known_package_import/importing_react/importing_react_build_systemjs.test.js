import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { buildProject, commonJsToEsModule } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import { browserImportSystemJsBuild } from "@jsenv/core/test/browserImportSystemJsBuild.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `importing_react.html`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.html",
}
const customCompilers = {
  "./node_modules/react/index.js": (options) =>
    commonJsToEsModule({
      ...options,
      processEnvNodeEnv: "production",
    }),
}
const { buildMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // compileServerLogLevel: "debug",
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  // filesystemCache: true,
  buildDirectoryRelativeUrl,
  entryPointMap,
  customCompilers,
})
const mainJsBuildRelativeUrl =
  buildMappings[`${testDirectoryRelativeUrl}importing_react.js`]
const { namespace } = await browserImportSystemJsBuild({
  ...IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
  testDirectoryRelativeUrl,
  mainRelativeUrl: `./${mainJsBuildRelativeUrl}`,
  // headless: false,
  // autoStop: false,
})

const actual = namespace
const expected = {
  default: "object",
}
assert({ actual, expected })
