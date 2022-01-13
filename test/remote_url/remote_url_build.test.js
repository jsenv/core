/*
 * TODO:
 * - test with systemjs
 * - rename "externalImportSpecifiers" -> "ignoredUrls"
 * - test that when url is specified in  "ignoredUrls" the url is kept intact
 * (meaning the code generated after build still perform the http request)
 * - remote url should be fetched too in ressource_builder (again except if specified in "ignoredUrls")
 */

import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  // resolveUrl,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"

const { server } = await import("./script/serve.js")
try {
  const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
  const testDirectoryRelativeUrl = urlToRelativeUrl(
    testDirectoryUrl,
    jsenvCoreDirectoryUrl,
  )
  const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
  const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
  const entryPoints = {
    [`./${testDirectoryRelativeUrl}main.html`]: "main.html",
  }
  // const buildDirectoryUrl = resolveUrl(
  //   buildDirectoryRelativeUrl,
  //   jsenvCoreDirectoryUrl,
  // )
  const test = async (params) => {
    const { buildMappings } = await buildProject({
      ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
      // logLevel: "debug",
      jsenvDirectoryRelativeUrl,
      buildDirectoryRelativeUrl,
      entryPoints,
      ...params,
    })
    return { buildMappings }
  }

  const actual = await test()
  const expected = actual
  assert({ actual, expected })
} finally {
  server.stop()
}
