import { urlToFileSystemPath, resolveUrl } from "@jsenv/util"
import { require } from "./internal/require.js"

export const convertCommonJsWithRollup = async ({
  url,
  urlAfterTransform,
  replaceGlobalObject = true,
  replaceGlobalFilename = true,
  replaceGlobalDirname = true,
  replaceProcessEnvNodeEnv = true,
  replaceProcess = true,
  replaceBuffer = true,
  processEnvNodeEnv = process.env.NODE_ENV,
  replaceMap = {},
  convertBuiltinsToBrowser = true,
  external = [],
} = {}) => {
  if (!url.startsWith("file:///")) {
    // it's possible to make rollup compatible with http:// for instance
    // as we do in @jsenv/bundling
    // however it's an exotic use case for now
    throw new Error(`compatible only with file:// protocol, got ${url}`)
  }

  const { rollup } = require("rollup")
  const commonjs = require("@rollup/plugin-commonjs")
  const { nodeResolve } = require("@rollup/plugin-node-resolve")
  const createJSONRollupPlugin = require("@rollup/plugin-json")
  const createReplaceRollupPlugin = require("@rollup/plugin-replace")
  const builtins = require("rollup-plugin-node-builtins-brofs")
  const createNodeGlobalRollupPlugin = require("rollup-plugin-node-globals")

  const filePath = urlToFileSystemPath(url)

  const nodeBuiltinsRollupPlugin = builtins()

  const nodeResolveRollupPlugin = nodeResolve({
    mainFields: ["main"],
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
    input: filePath,
    inlineDynamicImports: true,
    external,
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
    sourcemapExcludeSources: true,
    ...(urlAfterTransform ? { dir: urlToFileSystemPath(resolveUrl("./", urlAfterTransform)) } : {}),
  }

  const result = await rollupBundle.generate(generateOptions)

  return result.output[0]
}

const __filenameReplacement = `import.meta.url.slice('file:///'.length)`

const __dirnameReplacement = `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')`
