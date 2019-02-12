import createBabelRollupPlugin from "rollup-plugin-babel"
import createNodeResolveRollupPlugin from "rollup-plugin-node-resolve"
import { uneval } from "@dmail/uneval"
import { createOperation } from "@dmail/cancellation"
import { fileWrite } from "@dmail/helper"
import { rootname as selfRootname } from "../../rootname.js"
import { compileMapToBabelPlugins } from "../compileMapToBabelPlugins.js"
import { writeRollupBundle } from "../writeRollupBundle.js"

export const generateBalancerFilesForBrowser = async ({
  cancellationToken,
  rootname,
  into,
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
          rootname,
          into,
          entryFile,
          globalName,
          compileMap,
          compileParamMap,
          rollupOptions,
        }),
        generateBalancerPage({
          cancellationToken,
          rootname,
          into,
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
  rootname,
  into,
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
      input: `${selfRootname}/src/bundle/browser/browser-balancer-template.js`,
      plugins: [jsenvRollupPlugin, nodeResolveRollupPlugin, babelRollupPlugin],
    },
    outputOptions: {
      file: `${rootname}/${into}/${entryFile}`,
      sourcemap: true,
      ...rollupOptions,
    },
  })
}

const generateBalancerPage = async ({
  cancellationToken,
  rootname,
  into,
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
    start: () => fileWrite(`${rootname}/${into}/${entryName}.html`, html),
  })
}
