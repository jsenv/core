import { readFileSync } from "fs"
import { assert } from "@dmail/assert"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { createInstrumentBabelPlugin } from "@jsenv/testing/src/coverage/instrument-babel-plugin.js"
import { jsenvCorePathname } from "../../../src/jsenvCorePath.js"
import { compileJs } from "../../../src/compileJs/compileJs.js"
import { fileHrefToFolderRelativePath } from "../../fileHrefToFolderRelativePath.js"

const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

const projectPathname = jsenvCorePathname
const folderRelativePath = fileHrefToFolderRelativePath(import.meta.url)
const sourceRelativePath = `${folderRelativePath}/file.js`
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
