import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { execute, chromiumRuntime, textToJsModule } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { EXECUTE_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_EXECUTE.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}main.html`

const { status, namespace } = await execute({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  runtime: chromiumRuntime,
  stopAfterExecute: true,
  fileRelativeUrl: htmlFileRelativeUrl,
  customCompilers: {
    "**/*.txt": textToJsModule,
  },
})
const actual = {
  status,
  namespace,
}
const expected = {
  status: "completed",
  namespace: {
    "./main.mjs": {
      status: "completed",
      namespace: {
        answer: "42",
      },
    },
  },
}
assert({ actual, expected })
