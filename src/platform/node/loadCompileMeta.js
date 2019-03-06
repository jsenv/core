import { memoizeOnce, fileRead } from "@dmail/helper"
import { fileHrefToPathname } from "@jsenv/module-resolution"
import { detect } from "./nodeDetect/index.js"
import { nodeToCompileId } from "./nodeToCompileId.js"

export const loadCompileMeta = memoizeOnce(async ({ compileInto, sourceOrigin }) => {
  const groupDescriptionHref = `${sourceOrigin}/${compileInto}/groupDescription.json`
  const groupDescriptionPathname = fileHrefToPathname(groupDescriptionHref)
  const groupDescriptionFileContent = await fileRead(groupDescriptionPathname)
  const groupDescription = JSON.parse(groupDescriptionFileContent)
  const node = detect()
  const compileId = nodeToCompileId(node, groupDescription) || "otherwise"

  return { groupDescription, compileId }
})
