import { uneval } from "@dmail/uneval"
import { readProjectImportMap } from "../../import-map/readProjectImportMap.js"
import { filenameRelativeInception } from "../../filenameRelativeInception.js"
import { bundleNode } from "../../bundle/node/bundleNode.js"
import { serveCompiledFile } from "../serve-compiled-file/index.js"

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

  return serveCompiledFile({
    projectFolder,
    headers,
    sourceFilenameRelative: nodeClientFilenameRelativeInception,
    compiledFilenameRelative: `${compileInto}/${nodeClientFilenameRelativeInception}`,
    compile: async () => {
      const importMap = readProjectImportMap({
        projectFolder,
        importMapFilenameRelative,
      })

      const entryPointMap = {
        nodeClient: nodeClientFilenameRelativeInception,
      }

      const nodeGroupResolverFilenameRelativeInception = filenameRelativeInception({
        projectFolder,
        filenameRelative: nodeGroupResolverFilenameRelative,
      })

      const inlineSpecifierMap = {
        ["NODE_CLIENT_DATA.js"]: () => generateNodeClientDataSource({ importMap, groupMap }),
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
        logBundleFilePaths: false,
      })
      const main = bundle.output[0]
      return {
        contentType: "application/javascript",
        compiledSource: main.code,
        sources: main.map.sources,
        sourcesContent: main.map.sourcesContent,
        assets: ["main.map.js"],
        assetsSource: [JSON.stringify(main.map)],
        writeCompiledSourceFile: false, // already written by rollup
        writeAssetsFile: false, // already written by rollup
      }
    },
    // for now disable cache for client because veryfing
    // it would mean ensuring the whole bundle is still valid
    // I suspect it is faster to regenerate the bundle than check
    // if it's still valid.
    clientCompileCacheStrategy: "none",
  })
}

const generateNodeClientDataSource = ({
  importMap,
  groupMap,
}) => `export const importMap = ${uneval(importMap)}
export const groupMap = ${uneval(groupMap)}`
