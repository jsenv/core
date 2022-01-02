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
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}main.html`
const test = async (params) => {
  const { namespace, compileServerOrigin } = await execute({
    ...EXECUTE_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    runtime: chromiumRuntime,
    stopAfterExecute: true,
    fileRelativeUrl: htmlFileRelativeUrl,
    collectCompileServerInfo: true,
    ...params,
  })
  return { namespace, compileServerOrigin }
}

{
  const { compileServerOrigin, namespace } = await test()
  const actual = {
    namespace,
  }
  const expected = {
    namespace: {
      "./main.html__inline__16.js": {
        status: "completed",
        namespace: {
          namespace: {
            worker: {
              url: `${compileServerOrigin}/test/workers/workers_complex/worker/worker.js`,
              pingResponse: "pong",
            },
            serviceWorker: {
              url: `${compileServerOrigin}/test/workers/workers_complex/service_worker/sw.js`,
              inspectResponse: {
                order: [],
                generatedUrlsConfig: undefined,
              },
            },
            classicWorker: {
              url: `${compileServerOrigin}/test/workers/workers_complex/classic_worker/worker.js`,
              pingResponse: "pong",
            },
            classicServiceWorker: {
              url: `${compileServerOrigin}/test/workers/workers_complex/classic_service_worker/sw.js`,
              inspectResponse: {
                order: ["before-a", "before-b", "b", "after-b", "after-a"],
                generatedUrlsConfig: undefined,
              },
            },
          },
        },
      },
    },
  }
  assert({ actual, expected })
}

{
  const { compileServerOrigin, namespace } = await test({
    runtimeParams: {
      // headless: false,
      forceCompilation: true,
    },
    // stopAfterExecute: false,
  })
  const actual = {
    namespace,
  }
  const expected = {
    namespace: {
      "./main.html__asset__16.js": {
        status: "completed",
        namespace: {
          namespace: {
            worker: {
              url: `${compileServerOrigin}/test/workers/workers_complex/.jsenv/dev/best/test/workers/workers_complex/worker/worker.js`,
              pingResponse: "pong",
            },
            serviceWorker: {
              url: `${compileServerOrigin}/test/workers/workers_complex/.jsenv/dev/best/test/workers/workers_complex/service_worker/sw.js`,
              inspectResponse: {
                order: [],
                generatedUrlsConfig: undefined,
              },
            },
            classicWorker: {
              url: `${compileServerOrigin}/test/workers/workers_complex/classic_worker/worker.js`,
              pingResponse: "pong",
            },
            classicServiceWorker: {
              url: `${compileServerOrigin}/test/workers/workers_complex/classic_service_worker/sw.js`,
              inspectResponse: {
                order: ["before-a", "before-b", "b", "after-b", "after-a"],
                generatedUrlsConfig: undefined,
              },
            },
          },
        },
      },
    },
  }
  assert({ actual, expected })
}
