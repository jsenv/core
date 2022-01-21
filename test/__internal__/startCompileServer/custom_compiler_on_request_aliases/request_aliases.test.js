import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { fetchUrl, pluginRessourceAliases } from "@jsenv/server"

import { jsenvRuntimeSupportDuringDev } from "@jsenv/core/src/jsenvRuntimeSupportDuringDev.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS_COMPILE_SERVER.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const compileDirectoryRelativeUrlPattern = `${jsenvDirectoryRelativeUrl}*/${testDirectoryRelativeUrl}`

let ressourceBeforeAlias
const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  compileCacheStrategy: "etag",
  runtimeSupport: jsenvRuntimeSupportDuringDev,
  plugins: {
    ...pluginRessourceAliases({
      [`/${compileDirectoryRelativeUrlPattern}dir/*.js`]: `/${compileDirectoryRelativeUrlPattern}dir/file.js`,
    }),
  },
  customCompilers: {
    "**/dir/file.js": async ({ code, request }) => {
      ressourceBeforeAlias = request.ressourceBeforeAlias
      return {
        compiledSource: code,
      }
    },
  },
})
const { compileId } = await compileServer.createCompileIdFromRuntimeReport({})
const compileDirectoryRelativeUrl = `${jsenvDirectoryRelativeUrl}${compileId}/${testDirectoryRelativeUrl}`
const fileServerUrl = `${compileServer.origin}/${compileDirectoryRelativeUrl}dir/34556.js`
const response = await fetchUrl(fileServerUrl, {
  ignoreHttpsError: true,
})

const actual = {
  status: response.status,
  contentType: response.headers.get("content-type"),
  ressourceBeforeAlias,
}
const expected = {
  status: 200,
  contentType: "application/javascript",
  ressourceBeforeAlias: `/${compileDirectoryRelativeUrl}dir/34556.js`,
}
assert({ actual, expected })
