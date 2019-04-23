// IMPORT_MAP.js will resolved at build time
// eslint-disable-next-line import/no-unresolved
import importMap from "IMPORT_MAP.json"

// BROWSER_PLATFORM_DATA.js will generated at build time
// eslint-disable-next-line import/no-unresolved
import { groupMap } from "BROWSER_PLATFORM_DATA.js"

// BROWSER_GROUP_RESOLVER.js will be resolved at build time
// eslint-disable-next-line import/no-unresolved
import { resolveBrowserGroup } from "BROWSER_GROUP_RESOLVER.js"

import { memoizeOnce } from "@dmail/helper/src/memoizeOnce.js"
import { wrapImportMap } from "../../import-map/wrapImportMap.js"
import { createSystemImporter } from "./system/createSystemImporter.js"

export const loadBrowserImporter = memoizeOnce(async ({ compileInto, compileServerOrigin }) => {
  const compileId = await decideCompileId()
  const wrappedImportMap = wrapImportMap(importMap, `${compileInto}/${compileId}`)

  const { importFile } = createSystemImporter({
    importMap: wrappedImportMap,
    compileInto,
    compileServerOrigin,
    compileId,
  })

  return { compileId, importFile }
})

const decideCompileId = async () => {
  const returnedGroupId = await resolveBrowserGroup({ groupMap })

  if (typeof returnedGroupId === undefined) return "otherwise"

  if (returnedGroupId in groupMap === false) {
    throw new Error(
      `resolveBrowserGroup must return one of ${Object.keys(groupMap)}, got ${returnedGroupId}`,
    )
  }

  return returnedGroupId
}
