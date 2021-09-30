import { urlToFileSystemPath, resolveUrl } from "@jsenv/filesystem"

import { require } from "./internal/require.js"
import { transformResultToCompilationResult } from "./internal/compiling/transformResultToCompilationResult.js"

export const commonJsToJavaScriptModule = async ({
  url,
  compiledUrl,
  projectDirectoryUrl,

  sourcemapExcludeSources,

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
    // however it's an exotic use case for now
    throw new Error(`compatible only with file:// protocol, got ${url}`)
  }

  const { rollup } = await import("rollup")
  const { default: commonjs } = await import("@rollup/plugin-commonjs")
  const { nodeResolve } = await import("@rollup/plugin-node-resolve")
  const { default: createJSONRollupPlugin } = await import(
    "@rollup/plugin-json"
  )
  const { default: createReplaceRollupPlugin } = await import(
    "@rollup/plugin-replace"
  )
  const { default: createNodeGlobalRollupPlugin } = await import(
    "rollup-plugin-node-globals"
  )

  const builtins = require("rollup-plugin-node-builtins-brofs")

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

  const rollupBuild = await rollup({
    input: filePath,
    inlineDynamicImports: true,
    external,
    plugins: [
      commonJsRollupPlugin,
      createReplaceRollupPlugin({
        preventAssignment: true,
        values: {
          ...(replaceProcessEnvNodeEnv
            ? { "process.env.NODE_ENV": JSON.stringify(processEnvNodeEnv) }
            : {}),
          ...(replaceGlobalObject ? { global: "globalThis" } : {}),
          ...(replaceGlobalFilename
            ? { __filename: __filenameReplacement }
            : {}),
          ...(replaceGlobalDirname ? { __dirname: __dirnameReplacement } : {}),
          ...replaceMap,
        },
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
    ...(compiledUrl
      ? { dir: urlToFileSystemPath(resolveUrl("./", compiledUrl)) }
      : {}),
  }

  const { output } = await rollupBuild.generate(generateOptions)
  const { code, map } = output[0]

  return transformResultToCompilationResult(
    {
      contentType: "application/javascript",
      code,
      map,
    },
    {
      projectDirectoryUrl,
      originalFileContent: code,
      originalFileUrl: url,
      compiledFileUrl: compiledUrl,
      sourcemapFileUrl: `${compiledUrl}.map`,
      sourcemapExcludeSources,
    },
  )
}

const __filenameReplacement = `import.meta.url.slice('file:///'.length)`

const __dirnameReplacement = `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')`
