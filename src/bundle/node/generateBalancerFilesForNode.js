import createRollupBabelPlugin from "rollup-plugin-babel"
import { uneval } from "@dmail/uneval"
import { root as selfRoot } from "../../root.js"
import { compileMapToBabelPlugins } from "../compileMapToBabelPlugins.js"
import { writeRollupBundle } from "../writeRollupBundle.js"

export const generateBalancerFilesForNode = async ({
  cancellationToken,
  root,
  into,
  entryPointsDescription,
  compileMap,
  compileParamMap,
  rollupOptions,
}) => {
  return Promise.all(
    Object.keys(entryPointsDescription).map((entryName) => {
      const entryFile = `${entryName}.js`

      return generateBalancerFileForNode({
        cancellationToken,
        root,
        into,
        entryFile,
        compileMap,
        compileParamMap,
        rollupOptions,
      })
    }),
  )
}

const generateBalancerFileForNode = async ({
  cancellationToken,
  root,
  into,
  entryFile,
  compileMap,
  compileParamMap,
  rollupOptions,
}) => {
  const bundleNodeOptionsModuleSource = `
  export const compileMap = ${uneval(compileMap)}
  export const entryFile = ${uneval(entryFile)}`

  const rollupJsenvPlugin = {
    name: "jsenv-generate-node-main",
    resolveId: (importee) => {
      if (importee === "bundle-node-options") {
        return "bundle-node-options"
      }
      // this repository was not written with
      // the explicitNodeMoudle approach so it cannot
      // jsenv module resolution
      return null
    },

    load: async (id) => {
      if (id === "bundle-node-options") {
        return bundleNodeOptionsModuleSource
      }
      return null
    },
  }

  const compilePluginMap = compileParamMap.otherwise.pluginMap
  const babelPlugins = compileMapToBabelPlugins(compilePluginMap)

  const rollupBabelPlugin = createRollupBabelPlugin({
    babelrc: false,
    plugins: babelPlugins,
    parserOpts: {
      allowAwaitOutsideFunction: true,
    },
  })

  return writeRollupBundle({
    cancellationToken,
    inputOptions: {
      input: `${selfRoot}/src/bundle/node/node-balancer-template.js`,
      plugins: [rollupJsenvPlugin, rollupBabelPlugin],
    },
    outputOptions: {
      file: `${root}/${into}/${entryFile}`,
      sourcemap: true,
      ...rollupOptions,
    },
  })
}
