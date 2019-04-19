import { uneval } from "@dmail/uneval"
import { readProjectImportMap } from "../../import-map/readProjectImportMap.js"
import { filenameRelativeInception } from "../../filenameRelativeInception.js"
import { bundleNode } from "../../bundle/node/bundleNode.js"
import { serveCompiledFile } from "../serve-compiled-file/index.js"

export const serveNodeClient = ({
  projectFolder,
  importMapFilenameRelative,
  compileInto,
  babelConfigMap,
  groupMap,
  headers,
}) => {
  const nodeClientSourceFilenameRelative = `node_modules/@jsenv/core/src/node-client/index.js`
  const nodeClientCompiledFilenameRelative = `${compileInto}/${nodeClientSourceFilenameRelative}`
  const nodeClientSourceFilename = filenameRelativeInception({
    projectFolder,
    filenameRelative: nodeClientSourceFilenameRelative,
  })
  const nodeGroupResolverFilenameRelative = `node_modules/@jsenv/core/src/node-group-resolver/index.js`
  const nodeGroupResolverFilename = filenameRelativeInception({
    projectFolder,
    filenameRelative: nodeGroupResolverFilenameRelative,
  })

  return serveCompiledFile({
    projectFolder,
    headers,
    sourceFilenameRelative: nodeClientSourceFilenameRelative,
    compiledFilenameRelative: nodeClientCompiledFilenameRelative,
    compile: async () => {
      const importMap = readProjectImportMap({
        projectFolder,
        importMapFilenameRelative,
      })

      const bundle = await bundleNode({
        projectFolder,
        into: compileInto,
        entryPointMap: {
          nodeClient: "JSENV_NODE_CLIENT.js",
        },
        inlineSpecifierMap: {
          ["JSENV_NODE_CLIENT.js"]: nodeClientSourceFilename,
          ["NODE_CLIENT_DATA.js"]: () => generateNodeClientDataSource({ importMap, groupMap }),
          ["NODE_GROUP_RESOLVER.js"]: nodeGroupResolverFilename,
        },
        babelConfigMap,
        minify: false,
        throwUnhandled: false,
        compileGroupCount: 1,
        verbose: true,
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
