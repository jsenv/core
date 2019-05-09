// "/.jsenv/node-platform-data.js" resolved at build time
// eslint-disable-next-line import/no-unresolved
import { compileInto, groupMap } from "/.jsenv/node-platform-data.js"
// "/.jsenv/node-group-resolver.js" resolved at build time
// eslint-disable-next-line import/no-unresolved
import { resolveNodeGroup } from "/.jsenv/node-group-resolver.js"
// "/.jsenv/import-map.json" resolved at build time
// eslint-disable-next-line import/no-unresolved
import importMap from "/.jsenv/import-map.json"
import { memoizeOnce } from "@dmail/helper/src/memoizeOnce.js"
import { wrapImportMap } from "../../import-map/wrapImportMap.js"
import { createNodeSystem } from "./create-node-system.js"

const memoizedCreateNodeSystem = memoizeOnce(createNodeSystem)

export const createNodePlatform = ({ projectFolder, compileServerOrigin }) => {
  const compileId = decideCompileId()

  const filenameRelativeToCompiledHref = (filenameRelative) => {
    return `${compileServerOrigin}/${compileInto}/${compileId}/${filenameRelative}`
  }

  const wrappedImportMap = wrapImportMap(importMap, `${compileInto}/${compileId}`)

  const importFile = async (specifier) => {
    const nodeSystem = await memoizedCreateNodeSystem({
      projectFolder,
      compileServerOrigin,
      compileInto,
      importMap: wrappedImportMap,
    })
    return nodeSystem.import(specifier)
  }

  const executeFile = async (specifier, { collectCoverage, collectNamespace } = {}) => {
    const nodeSystem = await memoizedCreateNodeSystem({
      projectFolder,
      compileServerOrigin,
      compileInto,
      importMap: wrappedImportMap,
    })
    try {
      const namespace = await nodeSystem.import(specifier)
      return {
        status: "resolved",
        namespace: collectNamespace ? namespace : undefined,
        coverageMap: collectCoverage ? readCoverage() : undefined,
      }
    } catch (error) {
      console.error(error)
      return {
        status: "rejected",
        error,
        coverageMap: collectCoverage ? readCoverage() : undefined,
      }
    }
  }

  return {
    filenameRelativeToCompiledHref,
    importFile,
    executeFile,
  }
}

const decideCompileId = () => {
  const returnedGroupId = resolveNodeGroup({ groupMap })

  if (typeof returnedGroupId === "undefined") return "otherwise"

  if (returnedGroupId in groupMap === false) {
    throw new Error(
      `resolveNodeGroup must return one of ${Object.keys(groupMap)}, got ${returnedGroupId}`,
    )
  }

  return returnedGroupId
}

const readCoverage = () => global.__coverage__
