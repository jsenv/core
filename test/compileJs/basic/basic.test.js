import { readFileSync } from "fs"
import { assert } from "@dmail/assert"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { jsenvCorePathname, compileJs } from "../../../index.js"
import { fileHrefToFolderRelativePath } from "../../fileHrefToFolderRelativePath.js"

const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

const projectPathname = jsenvCorePathname
const folderRelativePath = fileHrefToFolderRelativePath(import.meta.url)
const codeRelativePath = `${folderRelativePath}/basic.js`
const codeFilePathname = `${projectPathname}${codeRelativePath}`
const codeHref = `file://${codeFilePathname}`
const codeFilePath = pathnameToOperatingSystemPath(codeFilePathname)
const code = readFileSync(codeFilePath).toString()

const actual = await compileJs({
  code,
  codeHref,
  projectPathname,
  babelPluginMap: jsenvBabelPluginMap,
})
const expected = {
  compiledSource: actual.compiledSource,
  contentType: "application/javascript",
  sources: [codeRelativePath],
  sourcesContent: [code],
  assets: [`basic.js__asset__/basic.js.map`],
  assetsContent: [actual.assetsContent[0]],
}
assert({ actual, expected })
