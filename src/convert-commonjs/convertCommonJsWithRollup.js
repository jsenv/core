const commonjs = import.meta.require("rollup-plugin-commonjs")
const nodeResolve = import.meta.require("rollup-plugin-node-resolve")
const builtins = import.meta.require("rollup-plugin-node-builtins")
const createJSONRollupPlugin = import.meta.require("rollup-plugin-json")
const createNodeGlobalRollupPlugin = import.meta.require("rollup-plugin-node-globals")
const createReplaceRollupPlugin = import.meta.require("rollup-plugin-replace")
const { rollup } = import.meta.require("rollup")

export const convertCommonJsWithRollup = async ({
  filename,
  replaceGlobalObject = true,
  replaceGlobalFilename = true,
  replaceGlobalDirname = true,
  replaceProcessEnvNodeEnv = true,
  replaceProcess = true,
  replaceBuffer = true,
  processEnvNodeEnv = process.env.NODE_ENV,
  replaceMap = {},
  convertBuiltinsToBrowser = true,
} = {}) => {
  const nodeBuiltinsRollupPlugin = builtins()

  const nodeResolveRollupPlugin = nodeResolve({
    mainFields: ["module", "jsnext:main", "main"],
  })

  const jsonRollupPlugin = createJSONRollupPlugin()

  const nodeGlobalRollupPlugin = createNodeGlobalRollupPlugin({
    global: false, // handled by replaceMap
    dirname: false, // handled by replaceMap
    filename: false, //  handled by replaceMap
    process: replaceProcess,
    buffer: replaceBuffer,
  })

  const commonJsRollupPlugin = commonjs()

  const rollupBundle = await rollup({
    input: filename,
    inlineDynamicImports: true,
    plugins: [
      commonJsRollupPlugin,
      createReplaceRollupPlugin({
        ...(replaceProcessEnvNodeEnv
          ? { "process.env.NODE_ENV": JSON.stringify(processEnvNodeEnv) }
          : {}),
        ...(replaceGlobalObject ? { global: "globalThis" } : {}),
        ...(replaceGlobalFilename ? { __filename: __filenameReplacement } : {}),
        ...(replaceGlobalDirname ? { __dirname: __dirnameReplacement } : {}),
        ...replaceMap,
      }),
      nodeGlobalRollupPlugin,
      ...(convertBuiltinsToBrowser ? [nodeBuiltinsRollupPlugin] : []),
      nodeResolveRollupPlugin,
      jsonRollupPlugin,
    ],
  })

  const generateOptions = {
    // https://rollupjs.org/guide/en#output-format
    format: "esm",
    // entryFileNames: `./[name].js`,
    // https://rollupjs.org/guide/en#output-sourcemap
    sourcemap: true,
    // we could exclude them
    // but it's better to put them directly
    // in case source files are not reachable
    // for whatever reason
    sourcemapExcludeSources: false,
  }

  const result = await rollupBundle.generate(generateOptions)

  return result.output[0]
}

const __filenameReplacement = `import.meta.url.slice('file:///'.length)`

const __dirnameReplacement = `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')`
