import { extname, basename, relative } from "path"
import { generateImportMapForPackage } from "@jsenv/node-module-import-map"
import { composeTwoImportMaps } from "@jsenv/import-map"
import {
  fileUrlToPath,
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveFileUrl,
} from "internal/urlUtils.js"
import { readProjectImportMap } from "internal/readProjectImportMap/readProjectImportMap.js"
import { generateBundle } from "internal/bundling/generateBundle/generateBundle.js"
import { bundleToCompilationResult } from "internal/bundling/bundleToCompilationResult.js"
import { serveCompiledFile } from "internal/compiling/serveCompiledFile.js"

export const serveBundle = async ({
  logger,
  jsenvProjectDirectoryUrl,
  projectDirectoryUrl,
  originalFileRelativeUrl,
  compiledFileRelativeUrl,
  sourcemapRelativePath = computeSourcemapRelativePath(compiledFileRelativeUrl),
  importDefaultExtension,
  importMapFileUrl,
  importMapForBundle = {},
  importReplaceMap = {},
  projectFileRequestedCallback,
  babelPluginMap,
  request,
  format,
  formatOutputOptions = {},
  node = format === "commonjs",
  browser = format === "global",
  sourcemapPreferLeadingSlash = true,
}) => {
  if (typeof jsenvProjectDirectoryUrl !== "string") {
    throw new TypeError(
      `jsenvProjectDirectoryUrl must be a string, got ${jsenvProjectDirectoryUrl}`,
    )
  }

  const compile = async () => {
    const entryExtname = extname(originalFileRelativeUrl)
    const entryBasename = basename(originalFileRelativeUrl, entryExtname)
    const entryName = entryBasename
    const entryPointMap = {
      [entryName]: `./${originalFileRelativeUrl}`,
    }

    const importMapForJsenvProjectUsingServeBundle = await generateImportMapForPackage({
      logger,
      projectDirectoryPath: fileUrlToPath(jsenvProjectDirectoryUrl),
      rootProjectDirectoryPath: fileUrlToPath(projectDirectoryUrl),
    })
    importMapForBundle = composeTwoImportMaps(
      importMapForBundle,
      importMapForJsenvProjectUsingServeBundle,
    )
    importReplaceMap = {
      ...importReplaceMap,
      "/.jsenv/compileServerImportMap.json": async () => {
        /**
         * Explanation of what happens here:
         *
         * To execute some code, jsenv injects some import like
         * import "@jsenv/core/helpers/regenerator-runtime/regenerator-runtime.js"
         * To find the corresponding file (which is inside @jsenv/core source code)
         * We use readProjectImportMap provided by @jsenv/core.
         * Internally it just adds @jsenv/core remapping to the project and
         * any of its dependency.
         * In practice only @jsenv/bundling and @jsenv/compile-server
         * will do that kind of stuff and depends directly on @jsenv/core.
         *
         * Other solution (for now rejected)
         *
         * Add an option to generateImportMapForProjectPackage
         * like fakeDependencies: {}
         * -> Rejected in favor of adding it explicitely in package.json
         *
         * Forcing every project to add either
         * "dependencies": { "@jsenv/helpers": "1.0.0"}
         * or
         * "peerDependencies": { "@jsenv/helpers": "1.0.0" }
         * And change the injected imports to @jsenv/helpers/*
         * -> Rejected because it would force project to declare the dependency
         * Even if in practice they do have this dependency
         * It feels strange.
         *
         * Inject "/node_modules/@jsenv/compile-server/node_modules/@jsenv/core/helpers/*"
         * instead of "@jsenv/core/helpers/*"
         * -> Rejected because it won't work when @jsenv/compile-server is a devDependency
         */
        const importMap = await readProjectImportMap({
          logger,
          projectDirectoryUrl,
          jsenvProjectDirectoryUrl,
          importMapFileUrl,
        })
        return JSON.stringify(importMap)
      },
    }

    const bundle = await generateBundle({
      logLevel: "off",
      projectDirectoryPath: fileUrlToPath(projectDirectoryUrl),
      // bundleDirectoryRelativeUrl is not really important
      // because we pass writeOnFileSystem: false anyway
      bundleDirectoryRelativeUrl: computebundleDirectoryRelativeUrl({
        projectDirectoryUrl,
        compiledFileRelativeUrl,
      }),
      importDefaultExtension,
      importMapFileRelativeUrl: urlToRelativeUrl(importMapFileUrl, projectDirectoryUrl),
      importMapForBundle,
      importReplaceMap,
      entryPointMap,
      sourcemapPreferLeadingSlash,
      babelPluginMap,
      compileGroupCount: 1,
      throwUnhandled: false,
      writeOnFileSystem: false,
      format,
      formatOutputOptions,
      node,
      browser,
    })

    const sourcemapPathForModule = sourcemapRelativePathToSourcemapPathForModule(
      sourcemapRelativePath,
      compiledFileRelativeUrl,
    )
    const sourcemapPathForCache = sourcemapRelativePathToSourcePathForCache(
      sourcemapRelativePath,
      compiledFileRelativeUrl,
    )

    return bundleToCompilationResult(bundle, {
      projectDirectoryUrl,
      sourcemapPathForModule,
      sourcemapPathForCache,
    })
  }

  return serveCompiledFile({
    projectDirectoryUrl,
    originalFileRelativeUrl,
    compiledFileRelativeUrl,
    projectFileRequestedCallback,
    compile,
    request,
  })
}

const computebundleDirectoryRelativeUrl = ({ projectDirectoryUrl, compiledFileRelativeUrl }) => {
  const compiledFileUrl = resolveFileUrl(compiledFileRelativeUrl, projectDirectoryUrl)
  const bundleDirectoryUrl = resolveDirectoryUrl("./", compiledFileUrl)
  const bundleDirectoryRelativeUrl = urlToRelativeUrl(bundleDirectoryUrl, projectDirectoryUrl)
  return bundleDirectoryRelativeUrl
}

const computeSourcemapRelativePath = (compiledFileRelativeUrl) => {
  const entryBasename = basename(compiledFileRelativeUrl)
  const compiledFileAssetDirectoryRelativePath = `${compiledFileRelativeUrl}/${entryBasename}__asset__/`
  const sourcemapRelativePath = `${compiledFileAssetDirectoryRelativePath}${entryBasename}.map`
  return sourcemapRelativePath
}

const sourcemapRelativePathToSourcemapPathForModule = (
  sourcemapRelativePath,
  compiledFileRelativeUrl,
) => {
  return `./${relative(compiledFileRelativeUrl, sourcemapRelativePath)}`
}

const sourcemapRelativePathToSourcePathForCache = (
  sourcemapRelativePath,
  compiledFileRelativeUrl,
) => {
  const entryBasename = basename(compiledFileRelativeUrl)
  const compiledFileAssetDirectoryRelativePath = `${compiledFileRelativeUrl}/${entryBasename}__asset__/`
  return relative(compiledFileAssetDirectoryRelativePath, sourcemapRelativePath)
}
