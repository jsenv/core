import { readFileSync } from "fs"
import { basename } from "path"
import { assert } from "@dmail/assert"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import {
  jsenvCorePathname,
  transformJs,
  transformResultToCompilationResult,
} from "../../../index.js"
import { fileHrefToFolderRelativePath } from "../../fileHrefToFolderRelativePath.js"

const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

const projectPathname = jsenvCorePathname
const folderRelativePath = fileHrefToFolderRelativePath(import.meta.url)
const folderName = basename(folderRelativePath)
const sourceRelativePath = `${folderRelativePath}/${folderName}.js`
const sourcePathname = `${projectPathname}${sourceRelativePath}`
const sourceHref = `file://${sourcePathname}`
const sourcePath = pathnameToOperatingSystemPath(sourcePathname)
const source = readFileSync(sourcePath).toString()

const transformResult = await transformJs({
  source,
  sourceHref,
  projectPathname,
  babelPluginMap: jsenvBabelPluginMap,
})
const actual = transformResultToCompilationResult(transformResult, { sourceHref, projectPathname })
const expected = {
  compiledSource: actual.compiledSource,
  contentType: "application/javascript",
  sources: [sourceRelativePath],
  sourcesContent: [source],
  assets: [`${folderName}.js__asset__/${folderName}.js.map`],
  assetsContent: [actual.assetsContent[0]],
}
assert({ actual, expected })
