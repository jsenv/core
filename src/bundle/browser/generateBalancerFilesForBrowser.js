import createBabelRollupPlugin from "rollup-plugin-babel"
import createNodeResolveRollupPlugin from "rollup-plugin-node-resolve"
import { uneval } from "@dmail/uneval"
import { createOperation } from "@dmail/cancellation"
import { fileWrite } from "@dmail/helper"
import { root as selfRoot } from "../../root.js"
import { compileMapToBabelPlugins } from "../compileMapToBabelPlugins.js"
import { writeRollupBundle } from "../writeRollupBundle.js"

export const generateBalancerFilesForBrowser = async ({
  cancellationToken,
  localRoot,
  bundleInto,
  entryPointsDescription,
  globalName,
  compileMap,
  compileParamMap,
  rollupOptions,
}) => {
  return Promise.all(
    Object.keys(entryPointsDescription).map((entryName) => {
      const entryFile = `${entryName}.js`

      return Promise.all([
        generateBalancerFileForBrowser({
          cancellationToken,
          localRoot,
          bundleInto,
          entryFile,
          globalName,
          compileMap,
          compileParamMap,
          rollupOptions,
        }),
        generateBalancerPage({
          cancellationToken,
          localRoot,
          bundleInto,
          entryName,
          entryFile,
          globalName,
        }),
      ])
    }),
  )
}

const generateBalancerFileForBrowser = async ({
  cancellationToken,
  localRoot,
  bundleInto,
  entryFile,
  compileMap,
  compileParamMap,
  rollupOptions,
}) => {
  const bundleBrowserOptionsModuleSource = `
export const compileMap = ${uneval(compileMap)}
export const entryFile = ${uneval(entryFile)}
`

  const jsenvRollupPlugin = {
    name: "jsenv-generate-browser-main",
    resolveId: (importee, importer) => {
      if (importee === "bundle-browser-options") {
        return "bundle-browser-options"
      }
      if (!importer) return importee
      return null
    },

    load: async (id) => {
      if (id === "bundle-browser-options") {
        return bundleBrowserOptionsModuleSource
      }
      return null
    },
  }

  const nodeResolveRollupPlugin = createNodeResolveRollupPlugin({
    module: true,
  })

  // compile using the worst possible scenario
  const compilePluginMap = compileParamMap.otherwise.pluginMap
  const babelPlugins = compileMapToBabelPlugins(compilePluginMap)

  const babelRollupPlugin = createBabelRollupPlugin({
    babelrc: false,
    plugins: babelPlugins,
  })

  return writeRollupBundle({
    cancellationToken,
    inputOptions: {
      input: `${selfRoot}/src/bundle/browser/browser-balancer-template.js`,
      plugins: [jsenvRollupPlugin, nodeResolveRollupPlugin, babelRollupPlugin],
    },
    outputOptions: {
      file: `${localRoot}/${bundleInto}/${entryFile}`,
      sourcemap: true,
      ...rollupOptions,
    },
  })
}

const generateBalancerPage = async ({
  cancellationToken,
  localRoot,
  bundleInto,
  entryFile,
  entryName,
}) => {
  const html = `<!doctype html>

<head>
  <title>Untitled</title>
  <meta charset="utf-8" />
</head>

<body>
  <main></main>
  <script src="./${entryFile}"></script>
</body>

</html>`

  await createOperation({
    cancellationToken,
    start: () => fileWrite(`${localRoot}/${bundleInto}/${entryName}.html`, html),
  })
}
