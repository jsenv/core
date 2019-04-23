// IMPORT_MAP.js will resolved at build time
// eslint-disable-next-line import/no-unresolved
import importMap from "IMPORT_MAP.json"

// NODE_PLATFORM_DATA.js will generated at build time
// eslint-disable-next-line import/no-unresolved
import { groupMap } from "NODE_PLATFORM_DATA.js"

// BROWSER_GROUP_RESOLVER.js is by default a jsenv internal resolver
// but can be overriden at build time to provide a custom
// resolveBrowserGroup function
// eslint-disable-next-line import/no-unresolved
import { resolveNodeGroup } from "NODE_GROUP_RESOLVER.js"

import { memoizeOnce } from "@dmail/helper"
import { wrapImportMap } from "../../import-map/wrapImportMap.js"
import { createImporter } from "./system/createImporter.js"

export const loadNodeImporter = memoizeOnce(
  async ({ compileInto, sourceOrigin, compileServerOrigin }) => {
    const compileId = await decideCompileId()
    const wrappedImportMap = wrapImportMap(importMap, `${compileInto}/${compileId}`)

    const { importFile } = await createImporter({
      importMap: wrappedImportMap,
      compileInto,
      sourceOrigin,
      compileServerOrigin,
      compileId,
    })

    return { compileId, importFile }
  },
)

const decideCompileId = async () => {
  const returnedGroupId = await resolveNodeGroup({ groupMap })

  if (typeof returnedGroupId === undefined) return "otherwise"

  if (returnedGroupId in groupMap === false) {
    throw new Error(
      `resolveNodeGroup must return one of ${Object.keys(groupMap)}, got ${returnedGroupId}`,
    )
  }

  return returnedGroupId
}
