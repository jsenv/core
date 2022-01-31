import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_SYSTEMJS_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import {
  findHtmlNodeById,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/internal/compile_server/html/html_ast.js"
import { getJavaScriptSourceMappingUrl } from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import { executeInBrowser } from "@jsenv/core/test/execute_in_browser.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `script_module_inline.html`
const htmlUrl = resolveUrl("script_module_inline.html", import.meta.url)
const htmlString = await readFile(htmlUrl)
const inlineScriptNode = findHtmlNodeById(htmlString, "script_module_inline")
const inlineScriptContent = getHtmlNodeTextNode(inlineScriptNode).value
const entryPoints = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "main.html",
}
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPoints,
  // minify: true,
})
const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
const htmlBuildString = await readFile(htmlBuildUrl)
const buildInlineScript = findHtmlNodeById(
  htmlBuildString,
  "script_module_inline",
)
const buildInlineScriptContent = getHtmlNodeTextNode(buildInlineScript).value
const sourcemapUrlForInlineScript = getJavaScriptSourceMappingUrl(
  buildInlineScriptContent,
)
const sourcemapUrl = resolveUrl(sourcemapUrlForInlineScript, htmlBuildUrl)
const sourcemap = await readFile(sourcemapUrl, { as: "json" })
{
  const actual = sourcemap
  const expected = {
    version: 3,
    file: "script_module_inline.html__inline__script_module_inline.js",
    sources: [
      "../../main.js",
      "../../script_module_inline.html__inline__script_module_inline.js",
    ],
    sourcesContent: [
      await readFile(new URL("./main.js", import.meta.url)),
      inlineScriptContent,
    ],
    names: assert.any(Array),
    mappings: assert.any(String),
  }
  assert({ actual, expected })
}

const { returnValue } = await executeInBrowser({
  directoryUrl: new URL("./", import.meta.url),
  htmlFileRelativeUrl: "./dist/systemjs/main.html",
  /* eslint-disable no-undef */
  pageFunction: () => {
    return window.namespace
  },
  /* eslint-enable no-undef */
})
const actual = returnValue
const expected = { answer: 42 }
assert({ actual, expected })
