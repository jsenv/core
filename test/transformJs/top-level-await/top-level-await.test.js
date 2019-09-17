import { basename } from "path"
import { readFileSync } from "fs"
import { assert } from "@dmail/assert"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { jsenvCorePathname, transformJs } from "../../../index.js"
import { fileHrefToFolderRelativePath } from "../../fileHrefToFolderRelativePath.js"

const { jsenvBabelPluginMap: babelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

const projectPathname = jsenvCorePathname
const folderRelativePath = fileHrefToFolderRelativePath(import.meta.url)
const folderName = basename(folderRelativePath)
const codeRelativePath = `${folderRelativePath}/${folderName}.js`
const codeFilePathname = `${projectPathname}${codeRelativePath}`
const sourceHref = `file://${codeFilePathname}`
const codeFilePath = pathnameToOperatingSystemPath(codeFilePathname)
const source = readFileSync(codeFilePath).toString()

const { code } = await transformJs({
  source,
  sourceHref,
  projectPathname,
  babelPluginMap,
})
const actual = code.indexOf("async function")
const expected = -1
assert({ actual, expected })
