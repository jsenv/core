import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl, resolveUrl, readFile } from "@jsenv/util"
import { generateBundle } from "@jsenv/core/index.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { requireCommonJsBundle } from "../requireCommonJsBundle.js"
import {
  GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativeUrl)
const bundleDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs/`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const mainFilename = `${testDirectoryBasename}.js`

await generateBundle({
  ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  // compileServerLogLevel: "debug",
  jsenvDirectoryRelativeUrl,
  bundleDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.cjs",
  },
  // filesystemCache: true,
})

{
  const { namespace } = await requireCommonJsBundle({
    ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
    bundleDirectoryRelativeUrl,
  })
  const actual = namespace
  const expected = { value: 42 }
  assert({ actual, expected })
}

// ensure sourcemap is generated
{
  const bundleDirectoryUrl = resolveUrl(bundleDirectoryRelativeUrl, jsenvCoreDirectoryUrl)
  const answerUrl = resolveUrl("answer.js", testDirectoryUrl)
  const basicUrl = resolveUrl("basic.js", testDirectoryUrl)
  const sourcemapBundleRelativeUrl = "main.cjs.map"
  const sourcemapBundleUrl = resolveUrl(sourcemapBundleRelativeUrl, bundleDirectoryUrl)
  const sourcemapString = await readFile(sourcemapBundleUrl)
  const actual = JSON.parse(sourcemapString)
  const expected = {
    version: 3,
    file: "main.cjs",
    sources: ["../../answer.js", "../../basic.js"],
    sourcesContent: [await readFile(answerUrl), await readFile(basicUrl)],
    names: actual.names,
    mappings: actual.mappings,
  }
  assert({ actual, expected })
}
