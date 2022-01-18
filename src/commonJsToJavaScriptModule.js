import { urlToFileSystemPath, resolveUrl } from "@jsenv/filesystem"

import { generateSourcemapUrl } from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import { transformResultToCompilationResult } from "@jsenv/core/src/internal/compiling/transformResultToCompilationResult.js"
import { rollupPluginCommonJsNamedExports } from "@jsenv/core/src/internal/compiling/rollup_plugin_commonjs_named_exports.js"

export const commonJsToJavaScriptModule = async ({
  logger,
  projectDirectoryUrl,
  jsenvRemoteDirectory,
  url,
  compiledUrl,

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
  sourcemapExcludeSources,
} = {}) => {
  if (!url.startsWith("file:///")) {
    // it's possible to make rollup compatible with http:// for instance
    // however it's an exotic use case for now
    throw new Error(`compatible only with file:// protocol, got ${url}`)
  }

  const filePath = urlToFileSystemPath(url)

  const { nodeResolve } = await import("@rollup/plugin-node-resolve")
  const nodeResolveRollupPlugin = nodeResolve({
    mainFields: [
      "browser:module",
      "module",
      "browser",
      "main:esnext",
      "jsnext:main",
      "main",
    ],
    extensions: [".mjs", ".cjs", ".js", ".json"],
    preferBuiltins: false,
    exportConditions: [],
  })

  const { default: createJSONRollupPlugin } = await import(
    "@rollup/plugin-json"
  )
  const jsonRollupPlugin = createJSONRollupPlugin({
    preferConst: true,
    indent: "  ",
    compact: false,
    namedExports: true,
  })

  const { default: createReplaceRollupPlugin } = await import(
    "@rollup/plugin-replace"
  )
  const replaceRollupPlugin = createReplaceRollupPlugin({
    preventAssignment: true,
    values: {
      ...(replaceProcessEnvNodeEnv
        ? { "process.env.NODE_ENV": JSON.stringify(processEnvNodeEnv) }
        : {}),
      ...(replaceGlobalObject ? { global: "globalThis" } : {}),
      ...(replaceGlobalFilename ? { __filename: __filenameReplacement } : {}),
      ...(replaceGlobalDirname ? { __dirname: __dirnameReplacement } : {}),
      ...replaceMap,
    },
  })

  const { default: commonjs } = await import("@rollup/plugin-commonjs")
  const commonJsRollupPlugin = commonjs({
    extensions: [".js", ".cjs"],
    // esmExternals: true,
    // defaultIsModuleExports: true,
    // requireReturnsDefault: "namespace",
    requireReturnsDefault: "auto",
  })

  const { default: createNodeGlobalRollupPlugin } = await import(
    "rollup-plugin-node-globals"
  )
  const nodeGlobalRollupPlugin = createNodeGlobalRollupPlugin({
    global: false, // handled by replaceMap
    dirname: false, // handled by replaceMap
    filename: false, // handled by replaceMap
    process: replaceProcess,
    buffer: replaceBuffer,
  })

  const commonJsNamedExportsRollupPlugin = rollupPluginCommonJsNamedExports({
    logger,
  })

  const { default: rollupPluginNodePolyfills } = await import(
    "rollup-plugin-polyfill-node"
  )

  const { rollup } = await import("rollup")
  const rollupBuild = await rollup({
    input: filePath,
    inlineDynamicImports: true,
    external,
    plugins: [
      nodeResolveRollupPlugin,
      jsonRollupPlugin,
      replaceRollupPlugin,
      commonJsRollupPlugin,
      commonJsNamedExportsRollupPlugin,
      nodeGlobalRollupPlugin,
      ...(convertBuiltinsToBrowser
        ? [
            rollupPluginNodePolyfills({
              include: null,
            }),
          ]
        : []),
    ],
    onwarn: (warning) => {
      const { loc, message } = warning
      const logMessage = loc
        ? `${loc.file}:${loc.line}:${loc.column} ${message}`
        : message

      // These warnings are usually harmless in packages, so don't show them by default
      if (
        warning.code === "CIRCULAR_DEPENDENCY" ||
        warning.code === "NAMESPACE_CONFLICT" ||
        warning.code === "THIS_IS_UNDEFINED" ||
        warning.code === "EMPTY_BUNDLE" ||
        warning.code === "UNUSED_EXTERNAL_IMPORT"
      ) {
        logger.debug(logMessage)
      } else {
        logger.warn(logMessage)
      }
    },
  })

  const generateOptions = {
    // https://rollupjs.org/guide/en#output-format
    format: "esm",
    // entryFileNames: `./[name].js`,
    // https://rollupjs.org/guide/en#output-sourcemap
    sourcemap: true,
    sourcemapExcludeSources,
    exports: "named",
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
      jsenvRemoteDirectory,
      originalFileUrl: url,
      compiledFileUrl: compiledUrl,
      sourcemapFileUrl: generateSourcemapUrl(compiledUrl),
      sourcemapExcludeSources,
      originalFileContent: code,
    },
  )
}

const __filenameReplacement = `import.meta.url.slice('file:///'.length)`

const __dirnameReplacement = `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')`
