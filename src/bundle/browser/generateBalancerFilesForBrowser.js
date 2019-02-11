import { rollup } from "rollup"
import createRollupBabelPlugin from "rollup-plugin-babel"
import { uneval } from "@dmail/uneval"
import { fileWrite } from "@dmail/helper"
import { localRoot as selfRoot } from "../../localRoot.js"
import { compileMapToBabelPlugins } from "../compileMapToBabelPlugins.js"

export const generateBalancerFilesForBrowser = async ({
  localRoot,
  bundleInto,
  entryPointObject,
  globalName,
  compileMap,
  compileParamMap,
  rollupOptions,
}) => {
  if (typeof globalName !== "string")
    throw new TypeError(`bundleMain expect globalName to be a string, got ${globalName}`)

  return Promise.all(
    Object.keys(entryPointObject).map((entryName) => {
      const entryFile = `${entryName}.js`

      return Promise.all([
        generateBalancerFileForBrowser({
          localRoot,
          bundleInto,
          entryFile,
          globalName,
          compileMap,
          compileParamMap,
          rollupOptions,
        }),
        generateBalancerPage({
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

  const rollupJsenvPlugin = {
    name: "jsenv-generate-browser-main",
    resolveId: (importee, importer) => {
      if (importee === "bundle-browser-options") {
        return "bundle-browser-options"
      }
      if (!importer) return importee
      // todo: check with an http/https import how rollup behaves with them?
      return null
    },

    load: async (id) => {
      if (id === "bundle-browser-options") {
        return bundleBrowserOptionsModuleSource
      }
      return null
    },
  }

  // compile using the worst possible scenario
  const compilePluginMap = compileParamMap.otherwise.pluginMap
  const babelPlugins = compileMapToBabelPlugins(compilePluginMap)

  const rollupBabelPlugin = createRollupBabelPlugin({
    babelrc: false,
    plugins: babelPlugins,
  })

  const options = {
    input: `${selfRoot}/src/bundle/browser/entry-template.js`,
    plugins: [rollupJsenvPlugin, rollupBabelPlugin],
  }

  const rollupBundle = await rollup(options)
  await rollupBundle.write({
    file: `${localRoot}/${bundleInto}/${entryFile}`,
    sourcemap: true,
    ...rollupOptions,
  })
}

const generateBalancerPage = async ({ localRoot, bundleInto, entryFile, entryName }) => {
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

  await fileWrite(`${localRoot}/${bundleInto}/${entryName}.html`, html)
}
