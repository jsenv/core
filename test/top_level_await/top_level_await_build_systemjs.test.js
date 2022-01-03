import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, readFile } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import { browserImportSystemJsBuild } from "@jsenv/core/test/browserImportSystemJsBuild.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const entryPoints = {
  [`./${testDirectoryRelativeUrl}top_level_await.html`]: "main.html",
}
const { buildMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPoints,
  // logLevel: "debug",
})
const mainJsBuildRelativeUrl =
  buildMappings[`${testDirectoryRelativeUrl}top_level_await.js`]
const { namespace } = await browserImportSystemJsBuild({
  ...IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
  testDirectoryRelativeUrl,
  mainRelativeUrl: `./${mainJsBuildRelativeUrl}`,
})
const fileContent = await readFile(
  new URL(`./dist/systemjs/${mainJsBuildRelativeUrl}`, import.meta.url),
)

{
  const actual = {
    containsAsync: fileContent.includes("async function"),
    namespace,
  }
  const expected = {
    containsAsync: false,
    namespace: { default: 42 },
  }
  assert({ actual, expected })
}
