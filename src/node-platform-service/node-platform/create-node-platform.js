import {
  compileIntoRelativePath,
  groupMap,
  importDefaultExtension,
  // "/.jsenv/node-platform-data.js" resolved at build time
  // eslint-disable-next-line import/no-unresolved
} from "/.jsenv/node-platform-data.js"
// "/.jsenv/node-group-resolver.js" resolved at build time
// eslint-disable-next-line import/no-unresolved
import { resolveNodeGroup } from "/.jsenv/node-group-resolver.js"
// "/.jsenv/import-map.json" resolved at build time
// eslint-disable-next-line import/no-unresolved
import importMap from "/.jsenv/import-map.json"
import { uneval } from "@dmail/uneval"
import { memoizeOnce } from "@dmail/helper/src/memoizeOnce.js"
import { wrapImportMap } from "../../import-map/wrapImportMap.js"
import { resolveCompileId } from "../../balancing/compile-id-resolution.js"
import { createNodeSystem } from "./create-node-system.js"

const memoizedCreateNodeSystem = memoizeOnce(createNodeSystem)

export const createNodePlatform = ({ compileServerOrigin, projectPathname }) => {
  const compileId = resolveCompileId({
    groupId: resolveNodeGroup({ groupMap }),
    groupMap,
  })

  const relativePathToCompiledHref = (relativePath) => {
    return `${compileServerOrigin}${compileIntoRelativePath}/${compileId}${relativePath}`
  }

  const wrappedImportMap = wrapImportMap(
    importMap,
    `${compileIntoRelativePath.slice(1)}/${compileId}`,
  )

  const importFile = async (specifier) => {
    const nodeSystem = await memoizedCreateNodeSystem({
      compileServerOrigin,
      projectPathname,
      compileIntoRelativePath,
      importMap: wrappedImportMap,
      importDefaultExtension,
    })
    return makePromiseKeepNodeProcessAlive(nodeSystem.import(specifier))
  }

  const executeFile = async (specifier, { collectCoverage, collectNamespace } = {}) => {
    const nodeSystem = await memoizedCreateNodeSystem({
      compileServerOrigin,
      projectPathname,
      compileIntoRelativePath,
      importMap: wrappedImportMap,
      importDefaultExtension,
    })
    try {
      const namespace = await makePromiseKeepNodeProcessAlive(nodeSystem.import(specifier))
      return {
        status: "completed",
        namespace: collectNamespace ? namespace : undefined,
        coverageMap: collectCoverage ? readCoverage() : undefined,
      }
    } catch (error) {
      console.error(error)
      return {
        status: "errored",
        exceptionSource: unevalException(error),
        coverageMap: collectCoverage ? readCoverage() : undefined,
      }
    }
  }

  return {
    relativePathToCompiledHref,
    importFile,
    executeFile,
  }
}

const unevalException = (value) => {
  return uneval(value)
}

const readCoverage = () => global.__coverage__

const makePromiseKeepNodeProcessAlive = async (promise) => {
  const timerId = setInterval(() => {}, 10000)

  try {
    const value = await promise
    return value
  } finally {
    clearInterval(timerId)
  }
}
