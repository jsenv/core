import { resolveUrl, readFile } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { transformJs } from "@jsenv/core/src/internal/compile_server/js/js_transformer.js"
import { loadBabelPluginMapFromFile } from "@jsenv/core/src/internal/compile_server/js/load_babel_plugin_map_from_file.js"
import { TRANSFORM_JS_TEST_PARAMS } from "../TEST_PARAMS_TRANSFORM_JS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const originalFileUrl = resolveUrl(`./top_level_await.js`, testDirectoryUrl)
const originalFileContent = await readFile(originalFileUrl)
const babelPluginMapFromFile = await loadBabelPluginMapFromFile({
  projectDirectoryUrl: testDirectoryUrl,
  // babelConfigFileUrl,
})
const { code } = await transformJs({
  ...TRANSFORM_JS_TEST_PARAMS,
  code: originalFileContent,
  url: originalFileUrl,
  babelPluginMap: {
    ...TRANSFORM_JS_TEST_PARAMS.babelPluginMap,
    ...babelPluginMapFromFile,
  },
  moduleOutFormat: "systemjs",
})
const actual = code.indexOf("async function")
const expected = -1
assert({ actual, expected })
