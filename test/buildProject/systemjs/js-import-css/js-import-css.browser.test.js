import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl, resolveUrl } from "@jsenv/util"
import { buildProject } from "@jsenv/core/index.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { browserImportSystemJsBuild } from "../browserImportSystemJsBuild.js"
import {
  GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `${testDirectoryname}.js`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.js",
}

const { bundleMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  useImportMapToImproveLongTermCaching: false,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
  minify: true,
})

const getBundleRelativeUrl = (urlRelativeToTestDirectory) => {
  const relativeUrl = `${testDirectoryRelativeUrl}${urlRelativeToTestDirectory}`
  const bundleRelativeUrl = bundleMappings[relativeUrl]
  return bundleRelativeUrl
}
const cssBundleRelativeUrl = getBundleRelativeUrl("style.css")

const { namespace, serverOrigin } = await browserImportSystemJsBuild({
  ...IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
  testDirectoryRelativeUrl,
  htmlFileRelativeUrl: "./index.html",
  // headless: false,
  // autoStop: false,
})
const actual = namespace
const expected = {
  cssUrl: resolveUrl(`/dist/systemjs/${cssBundleRelativeUrl}`, serverOrigin),
}
assert({ actual, expected })
