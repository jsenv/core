import { fetchUrl } from "@jsenv/server"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { importUsingChildProcess } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { startCompileServer } from "@jsenv/core/src/internal/compile_server/compile_server.js"
import { executeUsingNodeSystem } from "@jsenv/core/test/execute_using_node_system.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../../TEST_PARAMS_COMPILE_SERVER.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const fileRelativeUrl = `${testDirectoryRelativeUrl}file.js`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  processEnvNodeEnv: "prod",
})

{
  const { compileId } = await compileServer.createCompileIdFromRuntimeReport({
    env: { node: true },
    moduleOutFormat: "esmodule",
  })
  const compileDirectoryRelativeUrl = `${compileServer.jsenvDirectoryRelativeUrl}${compileId}/`
  const fileServerUrl = `${compileServer.origin}/${compileDirectoryRelativeUrl}${fileRelativeUrl}`
  await fetchUrl(fileServerUrl)
  const actual = await importUsingChildProcess(
    `${jsenvCoreDirectoryUrl}/${compileDirectoryRelativeUrl}${fileRelativeUrl}`,
  )
  const expected = {
    NODE_ENV: "prod",
  }
  assert({ actual, expected })
}

{
  const { compileId } = await compileServer.createCompileIdFromRuntimeReport({
    env: { node: true },
    moduleOutFormat: "systemjs",
  })
  const compileDirectoryRelativeUrl = `${compileServer.jsenvDirectoryRelativeUrl}${compileId}/`
  const fileServerUrl = `${compileServer.origin}/${compileDirectoryRelativeUrl}${fileRelativeUrl}`
  await fetchUrl(fileServerUrl)
  const actual = await executeUsingNodeSystem({
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    compileServerOrigin: compileServer.origin,
    compileDirectoryRelativeUrl,
    jsFileRelativeUrl: fileRelativeUrl,
  })
  const expected = {
    namespace: {
      NODE_ENV: "prod",
    },
  }
  assert({ actual, expected })
}
