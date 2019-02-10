import { rollup } from "rollup"
import { uneval } from "@dmail/uneval"
import { transpiler } from "../../jsCompile/transpiler.js"
import { localRoot as selfRoot } from "../../localRoot.js"

export const bundleMain = async ({
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
    Object.keys(entryPointObject).map((entryPoint) => {
      return bundleEntryPoint({
        localRoot,
        bundleInto,
        entryPoint: `${entryPoint}.js`,
        globalName,
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
  entryPoint,
  compileMap,
  compileParamMap,
  rollupOptions,
}) => {
  const bundleBrowserOptionsModuleSource = `
  export const compileMap = ${uneval(compileMap)}
  export const entryPoint = ${uneval(entryPoint)}`

  const plugin = {
    name: "jsenv-generate-browser-main",
    resolveId: (id) => {
      if (id === "bundle-browser-options") {
        return "bundle-browser-options"
      }
      return null
    },

    load: async (id) => {
      if (id === "bundle-browser-options") {
        return bundleBrowserOptionsModuleSource
      }
      return null
    },

    transform: async (moduleCode, id) => {
      const { map, code } = await transpiler({
        localRoot,
        file: id,
        fileAbsolute: id,
        input: moduleCode,
        pluginMap: compileParamMap.otherwise.pluginMap, // compile using the wors possible scenario
        remap: true,
      })
      return { code, map }
    },
  }

  const options = {
    input: `${selfRoot}/src/bundle/browser/entry-template.js`,
    plugins: [plugin],
  }

  const rollupBundle = await rollup(options)
  await rollupBundle.write({
    file: `${localRoot}/${bundleInto}/${entryPoint}`,
    sourcemap: true,
    ...rollupOptions,
  })
}
