import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { execute, chromiumRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
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
    [`${testDirectoryRelativeUrl}main.html`]: ({ code }) => {
      const htmlWithAnswer = code.replace(
        /__data_from_server__/,
        JSON.stringify({
          answer: 42,
        }),
      )
      return {
        compiledSource: htmlWithAnswer,
        responseHeaders: {
          "cache-control": "no-store",
        },
      }
    },
  },
})

const actual = {
  status,
  namespace,
}
const expected = {
  status: "completed",
  namespace: {
    "./main.html__asset__test.js": {
      status: "completed",
      namespace: {
        default: {
          answer: 42,
        },
      },
    },
  },
}
assert({ actual, expected })
