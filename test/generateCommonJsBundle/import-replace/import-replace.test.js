import { basename } from "path"
import { assert } from "@dmail/assert"
import { resolveDirectoryUrl } from "../../../src/urlHelpers.js"
import { generateCommonJsBundle, bundleToCompilationResult } from "../../../index.js"
import { importMetaUrlToDirectoryRelativePath } from "../../importMetaUrlToDirectoryRelativePath.js"
import { requireCommonJsBundle } from "../require-commonjs-bundle.js"
import {
  COMMONJS_BUNDLING_TEST_GENERATE_PARAM,
  COMMONJS_BUNDLING_TEST_REQUIRE_PARAM,
} from "../commonjs-bundling-test-param.js"

const testDirectoryRelativePath = importMetaUrlToDirectoryRelativePath(import.meta.url)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const bundleDirectoryRelativePath = `${testDirectoryRelativePath}dist/commonjs`
const mainFileBasename = `${testDirectoryBasename}.js`

const bundle = await generateCommonJsBundle({
  ...COMMONJS_BUNDLING_TEST_GENERATE_PARAM,
  bundleDirectoryRelativePath,
  entryPointMap: {
    main: `${testDirectoryRelativePath}${mainFileBasename}`,
  },
  importReplaceMap: {
    [`${testDirectoryRelativePath}whatever.js`]: () => `export default 42`,
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
      sources: [
        `${testDirectoryRelativePath.slice(1)}whatever.js`,
        `${testDirectoryRelativePath.slice(1)}${mainFileBasename}`,
      ],
      sourcesContent: ["export default 42", actual.sourcesContent[1]],
      names: actual.names,
      mappings: actual.mappings,
    }
    assert({ actual, expected })
  }
}

{
  const { namespace: actual } = await requireCommonJsBundle({
    ...COMMONJS_BUNDLING_TEST_REQUIRE_PARAM,
    bundleDirectoryRelativePath,
  })
  const expected = 42
  assert({ actual, expected })
}
