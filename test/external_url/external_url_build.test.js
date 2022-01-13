/*
 * TODO:
 * http url are not external by default anymore
 * we'll try to fetch them except if passed in "externalImportSpecifiers"
 *
 * We must ensure the file is properly transformed
 * We should check sourcemap (ideally they point to the http url)
 *
 * We could do the same for img, fonts, etc: fetch the http url by default
 * except if in "externalImportSpecifiers"
 * that should be renamed to ignoredUrls for example
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
