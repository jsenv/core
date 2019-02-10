import { rollup } from "rollup"
import { resolveImport } from "@jsenv/module-resolution"
import { generateCompileMap, compileMapToCompileParamMap } from "../server-compile/index.js"
import { transpiler } from "../jsCompile/transpiler.js"

/*
bundle/
  main.js
    si executé depuis node fait require('./node/main.js')
    si depuis browser inject un script './browser/main.js'

  browser/
    compileMap.json
      contient des infos sur best,worst,otherwise
    main.js
      load compileMap.json
      script load `/${compileId}/index.js`
    best/
      les fichiers compilé pour le profile best
    worst/
      les fichiers compilé pour le profile worst
    otherwise/
      les fichiers compilé pour le profile otherwise

  node/
    compileMap.json
      contient des infos sur best,worst,otherwise
    main.js
      load compileMap.json
      require(`/${compileId}/index.js`)
    best/
      les fichiers compilé pour le profile best
    worst/
      les fichiers compilé pour le profile worst
    otherwise/
      les fichiers compilé pour le profile otherwise

*/

export const bundle = async ({
  // todo: add cancellationToken stuff
  root,
  into = "bundle", // later update this to 'dist'
  entryPointObject = { main: "index.js" },
  pluginMap = {},
  compileGroupCount = 1,
  pluginCompatMap,
  platformUsageMap,
}) => {
  if (!root) throw new TypeError(`bundle expect root, got ${root}`)
  if (!into) throw new TypeError(`bundle expect into, got ${into}`)
  if (typeof entryPointObject !== "object")
    throw new TypeError(`bundle expect a entryPointObject, got ${entryPointObject}`)

  const localRoot = root
  const bundleInto = into

  const compileMap = generateCompileMap({
    pluginMap,
    compileGroupCount,
    pluginCompatMap,
    platformUsageMap,
  })

  debugger

  await bundlePlatform({
    localRoot,
    bundleInto,
    entryPointObject,
    compileMap,
    platformType: "node",
  })

  // todo: also write the browser bundle
  // todo: write compileParamMap into respective platform folders
  // todo: generate a given main.js for both platform
}

const bundlePlatform = async ({
  localRoot,
  bundleInto,
  entryPointObject,
  pluginMap,
  compileMap,
  platformType,
}) => {
  const compileParamMap = compileMapToCompileParamMap(compileMap, pluginMap)

  await Promise.all(
    Object.keys(compileMap).map((compileId) => {
      return bundlePlatformGroup({
        localRoot,
        bundleInto,
        entryPointObject,
        compileId,
        platformType,
        compileIdPluginMap: compileParamMap[compileId].pluginMap,
      })
    }),
  )
}

const bundlePlatformGroup = async ({
  localRoot,
  bundleInto,
  entryPointObject,
  compileId,
  platformType,
  compileIdPluginMap,
}) => {
  const resolveId = (importee, importer) => {
    if (!importer) return importee
    // todo: check with an http/https import how rollup behaves with them?
    return resolveImport({
      moduleSpecifier: importee,
      file: importer,
      root: localRoot,
      useNodeModuleResolutionInsideDedicatedFolder: true,
    })
  }

  // https://rollupjs.org/guide/en#transform
  const transform = async (moduleCode, id) => {
    const { map, code } = await transpiler({
      localRoot,
      file: id,
      fileAbsolute: id,
      input: moduleCode,
      pluginMap: compileIdPluginMap,
      remap: true,
    })

    return { code, map }
  }

  const jsenvRollupPlugin = {
    name: "jsenv",
    // not really required, we can read from filesystem
    // load: async (id) => {
    // },
    resolveId,
    // https://rollupjs.org/guide/en#resolvedynamicimport
    // resolveDynamicImport: () => {
    //   return false
    // },
    transform,
  }

  const options = {
    input: entryPointObject,
    plugins: [jsenvRollupPlugin],
    // skip rollup warnings
    onwarn: () => {},
  }
  const rollupBundle = await rollup(options)

  const result = await rollupBundle.write({
    // https://rollupjs.org/guide/en#output-dir
    dir: `${localRoot}/${bundleInto}/${platformType}/${compileId}`,
    // https://rollupjs.org/guide/en#output-format
    format: platformType === "browser" ? "iife" : "cjs",
    // https://rollupjs.org/guide/en#output-sourcemap
    sourcemap: true,
    sourcemapExcludeSources: true,
    // https://rollupjs.org/guide/en#experimentaltoplevelawait
    experimentalTopLevelAwait: true,
  })

  return result
}
