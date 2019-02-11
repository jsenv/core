import { rollup } from "rollup"
import createRollupBabelPlugin from "rollup-plugin-babel"
import { uneval } from "@dmail/uneval"
import { localRoot as selfRoot } from "../../localRoot.js"

export const bundleMain = async ({
  localRoot,
  bundleInto,
  entryPointObject,
  compileMap,
  compileParamMap,
  rollupOptions,
}) => {
  return Promise.all(
    Object.keys(entryPointObject).map((entryPointName) => {
      const entryPointFile = `${entryPointName}.js`

      return bundleEntryPoint({
        localRoot,
        bundleInto,
        entryPointFile,
        compileMap,
        compileParamMap,
        rollupOptions,
      })
    }),
  )
}

const bundleEntryPoint = async ({
  localRoot,
  bundleInto,
  entryPointFile,
  compileMap,
  compileParamMap,
  rollupOptions,
}) => {
  const bundleNodeOptionsModuleSource = `
  export const compileMap = ${uneval(compileMap)}
  export const entryPointFile = ${uneval(entryPointFile)}`

  const rollupJsenvPlugin = {
    name: "jsenv-generate-node-main",
    resolveId: (id) => {
      if (id === "bundle-node-options") {
        return "bundle-node-options"
      }
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
  const babelPlugins = Object.keys(compilePluginMap).map((name) => compilePluginMap[name])

  const rollupBabelPlugin = createRollupBabelPlugin({
    babelrc: false,
    plugins: babelPlugins,
  })

  const options = {
    input: `${selfRoot}/src/bundle/node/entry-template.js`,
    plugins: [rollupJsenvPlugin, rollupBabelPlugin],
  }

  const rollupBundle = await rollup(options)
  await rollupBundle.write({
    file: `${localRoot}/${bundleInto}/${entryPointFile}`,
    sourcemap: true,
    ...rollupOptions,
  })
}
