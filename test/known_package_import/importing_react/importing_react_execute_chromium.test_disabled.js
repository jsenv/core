import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import {
  execute,
  launchChromium,
  commonJsToJavaScriptModule,
} from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_EXECUTE.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}importing_react.html`

const actual = await execute({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  customCompilers: {
    "./node_modules/react/index.js": (options) =>
      commonJsToJavaScriptModule({
        ...options,
        processEnvNodeEnv: "production",
      }),
  },
  launch: launchChromium,
  stopAfterExecute: true,
  fileRelativeUrl: htmlFileRelativeUrl,
})
const expected = {
  status: "completed",
  namespace: {
    "./importing_react.js": {
      status: "completed",
      namespace: {
        ReactDefaultExport: true,
        useEffectExport: true,
      },
    },
  },
}
assert({ actual, expected })
