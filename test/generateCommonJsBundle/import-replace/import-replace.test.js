import { basename } from "path"
import { assert } from "@jsenv/assert"
import { bundleToCompilationResult } from "internal/bundling/bundleToCompilationResult.js"
import { resolveDirectoryUrl, fileUrlToRelativePath } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { generateCommonJsBundle } from "../../../index.js"
import { requireCommonJsBundle } from "../requireCommonJsBundle.js"
import {
  GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = fileUrlToRelativePath(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const bundleDirectoryRelativePath = `${testDirectoryRelativePath}dist/commonjs`
const mainFileBasename = `${testDirectoryBasename}.js`

const bundle = await generateCommonJsBundle({
  ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  bundleDirectoryRelativePath,
  entryPointMap: {
    main: `./${testDirectoryRelativePath}${mainFileBasename}`,
  },
  importReplaceMap: {
    [`./${testDirectoryRelativePath}whatever.js`]: () => `export default 42`,
  },
})

{
  const actual = await bundleToCompilationResult(bundle, {
    projectDirectoryUrl: resolveDirectoryUrl("./", import.meta.url),
  })
  const expected = {
    contentType: "application/javascript",
    compiledSource: actual.compiledSource,
    sources: [mainFileBasename],
    sourcesContent: [actual.sourcesContent[0]],
    assets: ["main.js.map"],
    assetsContent: [actual.assetsContent[0]],
  }
  assert({ actual, expected })

  {
    const actual = JSON.parse(actual.assetsContent[0])
    const expected = {
      version: 3,
      file: "main.js",
      sources: [`../../whatever.js`, `../../${mainFileBasename}`],
      sourcesContent: ["export default 42", actual.sourcesContent[1]],
      names: actual.names,
      mappings: actual.mappings,
    }
    assert({ actual, expected })
  }
}

{
  const { namespace: actual } = await requireCommonJsBundle({
    ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
    bundleDirectoryRelativePath,
  })
  const expected = 42
  assert({ actual, expected })
}
