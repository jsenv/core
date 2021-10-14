import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import {
  findHtmlNodeById,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { getJavaScriptSourceMappingUrl } from "@jsenv/core/src/internal/sourceMappingURLUtils.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const mainFilename = `main.html`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.html",
}
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const htmlString = await readFile(new URL("./main.html", import.meta.url))
const scriptNode = findHtmlNodeById(htmlString, "script_module_inline")
const scriptNodeContent = getHtmlNodeTextNode(scriptNode).value

const test = async (params) => {
  await buildProject({
    ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPointMap,
    ...params,
  })

  const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
  const htmlBuildString = await readFile(htmlBuildUrl)
  const scriptNode = findHtmlNodeById(htmlBuildString, "script_module_inline")
  const textNode = getHtmlNodeTextNode(scriptNode)
  const sourcemapUrlForInlineScript = getJavaScriptSourceMappingUrl(
    textNode.value,
  )
  const sourcemapUrl = resolveUrl(sourcemapUrlForInlineScript, htmlBuildUrl)
  const sourcemap = await readFile(sourcemapUrl, { as: "json" })
  return { sourcemap }
}

// without minification
{
  const { sourcemap } = await test({ minify: false })

  const actual = sourcemap
  const expected = {
    version: 3,
    file: "main.html__inline__script_module_inline.js",
    sources: ["../../main.html__inline__script_module_inline.js"],
    sourcesContent: [scriptNodeContent],
    names: assert.any(Array),
    mappings: assert.any(String),
  }
  assert({ actual, expected })
}

// with minification
{
  const { sourcemap } = await test({ minify: true })

  const actual = sourcemap
  const expected = {
    version: 3,
    file: "main.html__inline__script_module_inline.js",
    sources: ["../../main.html__inline__script_module_inline.js"],
    sourcesContent: [scriptNodeContent],
    names: assert.any(Array),
    mappings: assert.any(String),
  }
  assert({ actual, expected })
}
