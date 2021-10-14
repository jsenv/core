import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { execute, nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  EXECUTE_TEST_PARAMS,
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
  const result = await execute({
    ...EXECUTE_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    babelPluginMap,
    runtime: nodeRuntime,
    runtimeParams: {
      ...LAUNCH_TEST_PARAMS,
    },
    fileRelativeUrl,
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
      urlString: `${testDirectoryUrl}.jsenv/out-dev/best/${fileRelativeUrl}`,
    },
  }
  assert({ actual, expected })
}
