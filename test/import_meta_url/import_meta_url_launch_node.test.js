import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

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
const fileRelativeUrl = `${testDirectoryRelativeUrl}import_meta_url.js`
const test = async ({ babelPluginMap, runtimeParams } = {}) => {
  const result = await execute({
    ...EXECUTE_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    babelPluginMap,
    runtime: nodeRuntime,
    runtimeParams: {
      ...LAUNCH_TEST_PARAMS,
      ...runtimeParams,
    },
    fileRelativeUrl,
  })
  return result
}

// all babel plugin supported
{
  const { status, namespace } = await test()
  const actual = {
    status,
    namespace,
  }
  const expected = {
    status: "completed",
    namespace: {
      isInstanceOfUrl: false,
      urlString: `${testDirectoryUrl}import_meta_url.js`,
    },
  }
  assert({ actual, expected })
}

// compilation because of babel plugin
{
  const { status, namespace } = await test({
    babelPluginMap: {
      "not-supported": () => {
        return {}
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
      isInstanceOfUrl: false,
      urlString: `${testDirectoryUrl}import_meta_url.js`,
    },
  }
  assert({ actual, expected })
}

// compilation because of babel plugin + systemjs
{
  const { status, namespace } = await test({
    babelPluginMap: {
      "not-supported": () => {
        return {}
      },
    },
    runtimeParams: {
      moduleOutFormat: "systemjs",
    },
  })
  const actual = {
    status,
    namespace,
  }
  const expected = {
    status: "completed",
    namespace: {
      isInstanceOfUrl: false,
      urlString: `${testDirectoryUrl}.jsenv/out/${fileRelativeUrl}`,
    },
  }
  assert({ actual, expected })
}
