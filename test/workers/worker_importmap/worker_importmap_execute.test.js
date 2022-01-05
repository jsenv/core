import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { execute, chromiumRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_EXECUTE.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const test = async (params) => {
  const { namespace, compileServerOrigin } = await execute({
    ...EXECUTE_TEST_PARAMS,
    jsenvDirectoryRelativeUrl: `${testDirectoryRelativeUrl}.jsenv/`,
    runtime: chromiumRuntime,
    stopAfterExecute: true,
    fileRelativeUrl: `${testDirectoryRelativeUrl}main.html`,
    collectCompileServerInfo: true,
    importMapInWebWorkers: true,
    workers: [`${testDirectoryRelativeUrl}worker.js`],
    ...params,
  })
  return { namespace, compileServerOrigin }
}

const { namespace } = await test()
const actual = {
  namespace,
}
const expected = {
  namespace: {
    "./main.html__inline__16.js": {
      status: "completed",
      namespace: {
        namespace: {
          value: 42,
          pingResponse: 42,
        },
      },
    },
  },
}
assert({ actual, expected })
