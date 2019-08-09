import { readFileSync } from "fs"
import { assert } from "@dmail/assert"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { createInstrumentBabelPlugin } from "@jsenv/testing/src/coverage/instrument-babel-plugin.js"
import { JSENV_PATHNAME } from "../../../src/JSENV_PATH.js"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { compileJs } from "../../../src/compiled-js-service/compileJs.js"

const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

const projectPathname = JSENV_PATHNAME
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const sourceRelativePath = `${folderJsenvRelativePath}/file.js`
const filename = pathnameToOperatingSystemPath(`${projectPathname}${sourceRelativePath}`)
const source = readFileSync(filename).toString()
const babelPluginMap = {
  ...jsenvBabelPluginMap,
  "transform-instrument": [createInstrumentBabelPlugin()],
}

const actual = await compileJs({
  projectPathname,
  sourceRelativePath,
  babelPluginMap,
})
const expected = {
  compiledSource: actual.compiledSource,
  contentType: "application/javascript",
  sources: [sourceRelativePath],
  sourcesContent: [source],
  assets: ["file.js__asset__/file.js.map", "file.js__asset__/coverage.json"],
  assetsContent: [actual.assetsContent[0], actual.assetsContent[1]],
}

assert({
  actual,
  expected,
})
