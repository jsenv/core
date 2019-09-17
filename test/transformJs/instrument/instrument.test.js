import { readFileSync } from "fs"
import { basename } from "path"
import { assert } from "@dmail/assert"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { createInstrumentBabelPlugin } from "@jsenv/testing/src/coverage/instrument-babel-plugin.js"
import {
  jsenvCorePathname,
  transformJs,
  transformResultToCompilationResult,
} from "../../../index.js"
import { fileHrefToFolderRelativePath } from "../../fileHrefToFolderRelativePath.js"

const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

const projectPathname = jsenvCorePathname
const folderRelativePath = fileHrefToFolderRelativePath(import.meta.url)
const filename = `file.js`
const sourceRelativePath = `${folderRelativePath}/${filename}`
const sourcePathname = `${projectPathname}${sourceRelativePath}`
const sourceHref = `file://${sourcePathname}`
const sourcePath = pathnameToOperatingSystemPath(sourcePathname)
const source = readFileSync(sourcePath).toString()
const babelPluginMap = {
  ...jsenvBabelPluginMap,
  "transform-instrument": [createInstrumentBabelPlugin()],
}

const transformResult = await transformJs({
  source,
  sourceHref,
  projectPathname,
  babelPluginMap,
})
const actual = transformResultToCompilationResult(transformResult, { sourceHref, projectPathname })
const expected = {
  compiledSource: actual.compiledSource,
  contentType: "application/javascript",
  sources: [sourceRelativePath],
  sourcesContent: [source],
  assets: [`${filename}__asset__/${filename}.map`, `${filename}__asset__/coverage.json`],
  assetsContent: [actual.assetsContent[0], actual.assetsContent[1]],
}
assert({ actual, expected })
