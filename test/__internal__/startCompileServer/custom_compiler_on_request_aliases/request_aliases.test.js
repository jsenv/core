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
const compileDirectoryRelativeUrl = `${jsenvDirectoryRelativeUrl}out/best/${testDirectoryRelativeUrl}`

let ressourceBeforeAlias
const { origin: compileServerOrigin } = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  compileCacheStrategy: "etag",
  runtimeSupport: jsenvRuntimeSupportDuringDev,
  plugins: {
    ...pluginRessourceAliases({
      [`/${compileDirectoryRelativeUrl}dir/file.js`]: `/${compileDirectoryRelativeUrl}dir/*.js`,
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
const fileServerUrl = `${compileServerOrigin}/${compileDirectoryRelativeUrl}dir/34556.js`
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
