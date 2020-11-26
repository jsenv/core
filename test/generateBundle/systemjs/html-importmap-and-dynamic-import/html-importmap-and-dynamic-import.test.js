import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl, resolveUrl, readFile } from "@jsenv/util"
import { generateBundle } from "@jsenv/core/index.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { browserImportSystemJsBundle } from "../browserImportSystemJsBundle.js"
import {
  GENERATE_SYSTEMJS_BUNDLE_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `${testDirectoryname}.html`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.html",
}

const { bundleMappings } = await generateBundle({
  ...GENERATE_SYSTEMJS_BUNDLE_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
  // minify: true,
})
const getBundleRelativeUrl = (urlRelativeToTestDirectory) => {
  const relativeUrl = `${testDirectoryRelativeUrl}${urlRelativeToTestDirectory}`
  const bundleRelativeUrl = bundleMappings[relativeUrl]
  return bundleRelativeUrl
}

const bundleDirectoryUrl = resolveUrl(buildDirectoryRelativeUrl, jsenvCoreDirectoryUrl)

// importmap content
{
  const importmapBundleRelativeUrl = getBundleRelativeUrl("import-map.importmap")
  const fileBundleRelativeUrl = getBundleRelativeUrl("file.js")
  const fooBundleRelativeUrl = getBundleRelativeUrl("foo.js")
  const importmapBundleUrl = resolveUrl(importmapBundleRelativeUrl, bundleDirectoryUrl)
  const importmapString = await readFile(importmapBundleUrl)
  const importmap = JSON.parse(importmapString)
  const actual = importmap
  const expected = {
    imports: {
      // the original importmap remapping are still there (but an updated version)
      "foo": `./${fooBundleRelativeUrl}`,
      // the importmap for foo is available
      "./file.js": `./${fileBundleRelativeUrl}`,
      "./foo.js": `./${fooBundleRelativeUrl}`,
      // and nothing more because js is referencing only an other js
    },
  }
  assert({ actual, expected })
}

// assert asset url is correct for javascript (remapped + hashed)
{
  const mainRelativeUrl = getBundleRelativeUrl("file.js")
  const { namespace } = await browserImportSystemJsBundle({
    ...IMPORT_SYSTEM_JS_BUNDLE_TEST_PARAMS,
    testDirectoryRelativeUrl,
    mainRelativeUrl: `./${mainRelativeUrl}`,
    // debug: true,
  })
  const actual = namespace
  const expected = {
    value: 42,
  }
  assert({ actual, expected })
}
