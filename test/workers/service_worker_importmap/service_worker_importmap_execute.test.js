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
    serviceWorkers: [`${testDirectoryRelativeUrl}service_worker.js`],
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
    "./main.html__asset__22.js": {
      status: "completed",
      namespace: {
        namespace: {
          serviceWorker: {
            value: 42,
            inspectResponse: 42,
          },
        },
      },
    },
  },
}
assert({ actual, expected })
