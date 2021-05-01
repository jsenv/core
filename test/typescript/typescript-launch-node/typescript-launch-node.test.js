import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToFileSystemPath, urlToRelativeUrl } from "@jsenv/util"
import { require } from "../../../src/internal/require.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { launchAndExecute } from "@jsenv/core/src/internal/executing/launchAndExecute.js"
import { launchNode } from "@jsenv/core"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  LAUNCH_AND_EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_NODE.js"

const transformTypeScript = require("@babel/plugin-transform-typescript")

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const filename = `${testDirectoryname}.ts`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...START_COMPILE_SERVER_TEST_PARAMS,
  babelPluginMap: {
    ...START_COMPILE_SERVER_TEST_PARAMS.babelPluginMap,
    "transform-typescript": [transformTypeScript],
  },
  compileGroupCount: 1,
  jsenvDirectoryRelativeUrl,
})

const result = await launchAndExecute({
  ...LAUNCH_AND_EXECUTE_TEST_PARAMS,
  fileRelativeUrl,
  launch: (options) =>
    launchNode({
      ...LAUNCH_TEST_PARAMS,
      ...options,
      outDirectoryRelativeUrl,
      compileServerOrigin,
    }),
})
const actual = {
  status: result.status,
  namespace: result.namespace,
}
const expected = {
  status: "completed",
  namespace: {
    default: "Hello, Jane User",
  },
}
assert({ actual, expected })
