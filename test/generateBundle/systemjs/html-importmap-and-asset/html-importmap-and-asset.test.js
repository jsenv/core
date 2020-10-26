import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl, resolveUrl, readFile } from "@jsenv/util"
import { generateBundle } from "@jsenv/core/index.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { parseCssUrls } from "@jsenv/core/src/internal/bundling/css/parseCssUrls.js"
import { browserImportSystemJsBundle } from "../browserImportSystemJsBundle.js"
import {
  GENERATE_SYSTEMJS_BUNDLE_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const bundleDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `${testDirectoryname}.html`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.html",
}

const { bundleMappings } = await generateBundle({
  ...GENERATE_SYSTEMJS_BUNDLE_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  bundleDirectoryRelativeUrl,
  entryPointMap,
  // minify: true,
})
const getBundleRelativeUrl = (urlRelativeToTestDirectory) => {
  const relativeUrl = `${testDirectoryRelativeUrl}${urlRelativeToTestDirectory}`
  const bundleRelativeUrl = bundleMappings[relativeUrl]
  return bundleRelativeUrl
}

// assert asset url is correct for javascript (remapped + hashed)
{
  const mainRelativeUrl = getBundleRelativeUrl("file.js")
  const imgRemapRelativeUrl = getBundleRelativeUrl("img-remap.png")
  const { namespace, serverOrigin } = await browserImportSystemJsBundle({
    ...IMPORT_SYSTEM_JS_BUNDLE_TEST_PARAMS,
    testDirectoryRelativeUrl,
    mainRelativeUrl: `./${mainRelativeUrl}`,
    // debug: true,
  })
  const actual = namespace
  const expected = {
    default: resolveUrl(`dist/systemjs/${imgRemapRelativeUrl}`, serverOrigin),
  }
  assert({ actual, expected })
}

// assert asset url is correct for css (hashed)
{
  const bundleDirectoryUrl = resolveUrl(bundleDirectoryRelativeUrl, jsenvCoreDirectoryUrl)
  const imgRelativeUrl = getBundleRelativeUrl("img.png")
  const cssBundleRelativeUrl = getBundleRelativeUrl("style.css")
  const cssBundleUrl = resolveUrl(cssBundleRelativeUrl, bundleDirectoryUrl)
  const imgBundleUrl = resolveUrl(imgRelativeUrl, bundleDirectoryUrl)
  const cssString = await readFile(cssBundleUrl)
  const cssUrls = await parseCssUrls(cssString, cssBundleUrl)
  const actual = cssUrls.urlDeclarations[0].specifier
  const expected = urlToRelativeUrl(imgBundleUrl, cssBundleUrl)
  assert({ actual, expected })
}
