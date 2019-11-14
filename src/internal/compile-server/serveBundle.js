import { extname, basename, relative } from "path"
import { generateImportMapForPackage } from "@jsenv/node-module-import-map"
import { composeTwoImportMaps } from "@jsenv/import-map"
import {
  fileUrlToPath,
  resolveDirectoryUrl,
  fileUrlToRelativePath,
  resolveFileUrl,
} from "../urlUtils.js"
import { readProjectImportMap } from "../readProjectImportMap/readProjectImportMap.js"
import { generateBundle } from "../bundle/generateBundle/generateBundle.js"
import { bundleToCompilationResult } from "../bundle/bundleToCompilationResult.js"
import { serveCompiledFile } from "./serveCompiledFile.js"

export const serveBundle = async ({
  logger,
  jsenvProjectDirectoryUrl,
  projectDirectoryUrl,
  originalFileRelativePath,
  compiledFileRelativePath,
  sourcemapRelativePath = computeSourcemapRelativePath(compiledFileRelativePath),
  importDefaultExtension,
  importMapFileRelativePath,
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
    const entryExtname = extname(originalFileRelativePath)
    const entryBasename = basename(originalFileRelativePath, entryExtname)
    const entryName = entryBasename
    const entryPointMap = {
      [entryName]: `./${originalFileRelativePath}`,
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
          importMapFileRelativePath,
        })
        return JSON.stringify(importMap)
      },
    }

    const bundle = await generateBundle({
      logLevel: "off",
      projectDirectoryPath: fileUrlToPath(projectDirectoryUrl),
      // bundleDirectoryRelativePath is not really important
      // because we pass writeOnFileSystem: false anyway
      bundleDirectoryRelativePath: computeBundleDirectoryRelativePath({
        projectDirectoryUrl,
        compiledFileRelativePath,
      }),
      importDefaultExtension,
      importMapFileRelativePath,
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
      compiledFileRelativePath,
    )
    const sourcemapPathForCache = sourcemapRelativePathToSourcePathForCache(
      sourcemapRelativePath,
      compiledFileRelativePath,
    )

    return bundleToCompilationResult(bundle, {
      projectDirectoryUrl,
      sourcemapPathForModule,
      sourcemapPathForCache,
    })
  }

  return serveCompiledFile({
    projectDirectoryUrl,
    originalFileRelativePath,
    compiledFileRelativePath,
    projectFileRequestedCallback,
    compile,
    request,
  })
}

const computeBundleDirectoryRelativePath = ({ projectDirectoryUrl, compiledFileRelativePath }) => {
  const compiledFileUrl = resolveFileUrl(compiledFileRelativePath, projectDirectoryUrl)
  const bundleDirectoryUrl = resolveDirectoryUrl("./", compiledFileUrl)
  const bundleDirectoryRelativePath = fileUrlToRelativePath(bundleDirectoryUrl, projectDirectoryUrl)
  return bundleDirectoryRelativePath
}

const computeSourcemapRelativePath = (compiledFileRelativePath) => {
  const entryBasename = basename(compiledFileRelativePath)
  const compiledFileAssetDirectoryRelativePath = `${compiledFileRelativePath}/${entryBasename}__asset__/`
  const sourcemapRelativePath = `${compiledFileAssetDirectoryRelativePath}${entryBasename}.map`
  return sourcemapRelativePath
}

const sourcemapRelativePathToSourcemapPathForModule = (
  sourcemapRelativePath,
  compiledFileRelativePath,
) => {
  return `./${relative(compiledFileRelativePath, sourcemapRelativePath)}`
}

const sourcemapRelativePathToSourcePathForCache = (
  sourcemapRelativePath,
  compiledFileRelativePath,
) => {
  const entryBasename = basename(compiledFileRelativePath)
  const compiledFileAssetDirectoryRelativePath = `${compiledFileRelativePath}/${entryBasename}__asset__/`
  return relative(compiledFileAssetDirectoryRelativePath, sourcemapRelativePath)
}
