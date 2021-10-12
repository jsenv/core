import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  writeFile,
  readFile,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import {
  findHtmlNodeById,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { getJavaScriptSourceMappingUrl } from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import { browserImportSystemJsBuild } from "@jsenv/core/test/browserImportSystemJsBuild.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `script_module_inline.html`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.html",
}
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const { buildInlineFileContents } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
  // minify: true,
})

const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
const htmlString = await readFile(htmlBuildUrl)
const scriptNode = findHtmlNodeById(htmlString, "script_module_inline")
const textNode = getHtmlNodeTextNode(scriptNode)
const sourcemapUrlForInlineScript = getJavaScriptSourceMappingUrl(
  textNode.value,
)
const sourcemapUrl = resolveUrl(sourcemapUrlForInlineScript, htmlBuildUrl)
const sourcemap = await readFile(sourcemapUrl, { as: "json" })
{
  const actual = sourcemap
  const expected = {
    version: 3,
    file: "script_module_inline.script_module_inline.js",
    sources: ["../../main.js"],
    sourcesContent: [await readFile(new URL("./main.js", import.meta.url))],
    names: [],
    mappings: assert.any(String),
  }
  assert({ actual, expected })
}

const inlineFileBuildRelativeUrl =
  "script_module_inline.script_module_inline.js"
const inlineFileBuildUrl = resolveUrl(
  inlineFileBuildRelativeUrl,
  buildDirectoryUrl,
)
await writeFile(
  inlineFileBuildUrl,
  buildInlineFileContents[inlineFileBuildRelativeUrl],
)
const { namespace } = await browserImportSystemJsBuild({
  ...IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
  testDirectoryRelativeUrl,
  mainRelativeUrl: `./${inlineFileBuildRelativeUrl}`,
  // debug: true,
})

const actual = namespace
const expected = {
  value: 42,
}
assert({ actual, expected })
