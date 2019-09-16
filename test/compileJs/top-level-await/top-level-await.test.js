import { assert } from "@dmail/assert"
import { jsenvCorePathname } from "../../../src/jsenvCorePath/jsenvCorePath.js"
import { compileJs } from "../../../src/compileJs/compileJs.js"
import { fileHrefToFolderRelativePath } from "../../fileHrefToFolderRelativePath.js"

const { jsenvBabelPluginMap: babelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

const projectPathname = jsenvCorePathname
const folderRelativePath = fileHrefToFolderRelativePath(import.meta.url)
const sourceRelativePath = `${folderRelativePath}/top-level-await.js`

const { compiledSource } = await compileJs({
  projectPathname,
  sourceRelativePath,
  babelPluginMap,
})
const actual = compiledSource.indexOf("async function")
const expected = -1
assert({ actual, expected })
