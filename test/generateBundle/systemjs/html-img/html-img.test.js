import { basename } from "path"
import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  readFile,
  resolveUrl,
  assertFilePresence,
} from "@jsenv/util"
import { buildProject } from "@jsenv/core/index.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  findNodeByTagName,
  getHtmlNodeAttributeByName,
  parseSrcset,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { GENERATE_SYSTEMJS_BUNDLE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `${testDirectoryname}.html`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.html",
}

const { bundleMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUNDLE_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
})

const getBundleRelativeUrl = (urlRelativeToTestDirectory) => {
  const relativeUrl = `${testDirectoryRelativeUrl}${urlRelativeToTestDirectory}`
  const bundleRelativeUrl = bundleMappings[relativeUrl]
  return bundleRelativeUrl
}

const bundleDirectoryUrl = resolveUrl(buildDirectoryRelativeUrl, jsenvCoreDirectoryUrl)
const htmlBundleUrl = resolveUrl("main.html", bundleDirectoryUrl)
const htmlString = await readFile(htmlBundleUrl)
const img = findNodeByTagName(htmlString, "img")

// ensure src is properly updated
{
  const srcAttribute = getHtmlNodeAttributeByName(img, "src")
  const imgABundleRelativeUrl = getBundleRelativeUrl("img-a.png")
  const actual = srcAttribute.value
  const expected = imgABundleRelativeUrl
  assert({ actual, expected })
  // ensure corresponding file exists
  const imgABundleUrl = resolveUrl(imgABundleRelativeUrl, bundleDirectoryUrl)
  await assertFilePresence(imgABundleUrl)
}

// ensure srcset is properly updated
{
  const srcsetAttribute = getHtmlNodeAttributeByName(img, "srcset")
  const imgBBundleRelativeUrl = getBundleRelativeUrl("img-b.png")
  const imgCBundleRelativeUrl = getBundleRelativeUrl("img-c.png")
  const actual = parseSrcset(srcsetAttribute.value)
  const expected = [
    {
      specifier: imgBBundleRelativeUrl,
      descriptor: "200w",
    },
    {
      specifier: imgCBundleRelativeUrl,
      descriptor: "400w",
    },
  ]
  // and corresponding file exists
  assert({ actual, expected })
  const imgBBundleUrl = resolveUrl(imgBBundleRelativeUrl, bundleDirectoryUrl)
  await assertFilePresence(imgBBundleUrl)
  const imgCBundleUrl = resolveUrl(imgCBundleRelativeUrl, bundleDirectoryUrl)
  await assertFilePresence(imgCBundleUrl)
}
