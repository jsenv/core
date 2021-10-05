import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { launchNode } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { launchAndExecute } from "@jsenv/core/src/internal/executing/launchAndExecute.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  LAUNCH_AND_EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_NODE.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const filename = `import_meta_url.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const test = async ({ babelPluginMap } = {}) => {
  const { origin: compileServerOrigin, outDirectoryRelativeUrl } =
    await startCompileServer({
      ...START_COMPILE_SERVER_TEST_PARAMS,
      jsenvDirectoryRelativeUrl,
      importMapFileRelativeUrl: `${testDirectoryRelativeUrl}test.importmap`,
      babelPluginMap,
    })

  const result = await launchAndExecute({
    ...LAUNCH_AND_EXECUTE_TEST_PARAMS,
    launch: (options) =>
      launchNode({
        ...LAUNCH_TEST_PARAMS,
        ...options,
        outDirectoryRelativeUrl,
        compileServerOrigin,
      }),
    executeParams: {
      fileRelativeUrl,
    },
  })

  return result
}

// all babel plugin supported
{
  const actual = await test()
  const expected = {
    status: "completed",
    namespace: {
      isInstanceOfUrl: false,
      urlString: `${testDirectoryUrl}${filename}`,
    },
  }
  assert({ actual, expected })
}

// with a non-supported babel plugin
{
  const actual = await test({
    babelPluginMap: {
      "not-supported": () => {
        return {}
      },
    },
  })
  const expected = {
    status: "completed",
    namespace: {
      isInstanceOfUrl: false,
      urlString: `${testDirectoryUrl}.jsenv/out/best/${fileRelativeUrl}`,
    },
  }
  assert({ actual, expected })
}
