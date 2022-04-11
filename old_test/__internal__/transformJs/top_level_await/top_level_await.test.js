import { resolveUrl, readFile } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { loadBabelPluginMapFromFile } from "@jsenv/core/src/internal/compile_server/js/load_babel_plugin_map_from_file.js"
import { transformWithBabel } from "@jsenv/core/src/internal/transform_js/transform_with_babel.js"
import { TRANSFORM_JS_TEST_PARAMS } from "../TEST_PARAMS_TRANSFORM_JS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const sourceFileUrl = resolveUrl(`./top_level_await.js`, testDirectoryUrl)
const sourceFileContent = await readFile(sourceFileUrl)
const babelPluginMapFromFile = await loadBabelPluginMapFromFile({
  projectDirectoryUrl: testDirectoryUrl,
  // babelConfigFileUrl,
})
const { content } = await transformWithBabel({
  ...TRANSFORM_JS_TEST_PARAMS,
  babelPluginMap: {
    ...TRANSFORM_JS_TEST_PARAMS.babelPluginMap,
    ...babelPluginMapFromFile,
  },
  moduleOutFormat: "systemjs",
  url: sourceFileUrl,
  content: sourceFileContent,
})
const actual = content.indexOf("async function")
const expected = -1
assert({ actual, expected })
