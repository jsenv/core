import { uneval } from "@dmail/uneval"
import { readProjectImportMap } from "../../import-map/readProjectImportMap.js"
import { filenameRelativeInception } from "../../filenameRelativeInception.js"
import { bundleNode } from "../../bundle/node/bundleNode.js"
import { serveCompiledFile } from "../serve-compiled-file/index.js"
import { platformClientBundleToCompilationResult } from "../platformClientBundleToCompilationResult.js"

export const serveNodeClient = ({
  projectFolder,
  importMapFilenameRelative,
  nodeGroupResolverFilenameRelative,
  compileInto,
  babelConfigMap,
  groupMap,
  headers,
}) => {
  const nodeClientFilenameRelative = `node_modules/@jsenv/core/src/node-client/index.js`
  const nodeClientFilenameRelativeInception = filenameRelativeInception({
    projectFolder,
    filenameRelative: nodeClientFilenameRelative,
  })

  const platformClientName = "nodeClient"
  const platformClientDataSpecifier = "NODE_CLIENT_DATA.js"

  return serveCompiledFile({
    projectFolder,
    headers,
    sourceFilenameRelative: nodeClientFilenameRelativeInception,
    compiledFilenameRelative: `${compileInto}/${platformClientName}.js`,
    compile: async () => {
      const importMap = readProjectImportMap({
        projectFolder,
        importMapFilenameRelative,
      })

      const entryPointMap = {
        [platformClientName]: nodeClientFilenameRelativeInception,
      }

      const nodeGroupResolverFilenameRelativeInception = filenameRelativeInception({
        projectFolder,
        filenameRelative: nodeGroupResolverFilenameRelative,
      })

      const inlineSpecifierMap = {
        [platformClientDataSpecifier]: () => generateNodeClientDataSource({ importMap, groupMap }),
        ["NODE_GROUP_RESOLVER.js"]: `${projectFolder}/${nodeGroupResolverFilenameRelativeInception}`,
      }

      const bundle = await bundleNode({
        projectFolder,
        into: compileInto,
        entryPointMap,
        inlineSpecifierMap,
        babelConfigMap,
        compileGroupCount: 1,
        throwUnhandled: false,
        writeOnFileSystem: false,
        logBundleFilePaths: false,
      })
      return platformClientBundleToCompilationResult({
        projectFolder,
        importMapFilenameRelative,
        compileInto,
        platformClientName,
        platformClientDataSpecifier,
        bundle,
      })
    },
  })
}

const generateNodeClientDataSource = ({
  importMap,
  groupMap,
}) => `export const importMap = ${uneval(importMap)}
export const groupMap = ${uneval(groupMap)}`
