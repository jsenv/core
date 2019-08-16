import { extname, dirname, basename } from "path"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { serveCompiledFile } from "../compiled-file-service/index.js"

// important to use require here
// because @jsenv/bundling use relativePathInception
// and if we use direct import we will no longer
// execute @jsenv/bunling bundled files but sources files
// meaning if we use @jsenv/core bundle we'll fail
// to find the @jsenv/bundling files
const { generateBundle, bundleToCompilationResult } = import.meta.require("@jsenv/bundling")

export const serveBundle = async ({
  projectPathname,
  compileIntoRelativePath,
  sourceRelativePath,
  compileRelativePath,
  sourcemapPath,
  importMapRelativePath,
  importDefaultExtension,
  specifierMap,
  specifierDynamicMap,
  projectFileRequestedCallback,
  babelPluginMap,
  request,
  format,
  formatOutputOptions = {},
}) => {
  return serveCompiledFile({
    projectPathname,
    request,
    sourceRelativePath,
    compileRelativePath: `${compileIntoRelativePath}${compileRelativePath}`,
    projectFileRequestedCallback,
    compile: async () => {
      const entryExtname = extname(sourceRelativePath)
      const entryBasename = basename(sourceRelativePath, entryExtname)
      const entryDirname = dirname(sourceRelativePath)
      const entryName = entryBasename
      const bundleIntoRelativePath = entryDirname
        ? `${compileIntoRelativePath}${entryDirname}`
        : compileIntoRelativePath
      const entryPointMap = {
        [entryName]: sourceRelativePath,
      }

      const bundle = await generateBundle({
        projectPath: pathnameToOperatingSystemPath(projectPathname),
        bundleIntoRelativePath,
        importMapRelativePath,
        importDefaultExtension,
        specifierMap,
        specifierDynamicMap,
        entryPointMap,
        babelPluginMap,
        compileGroupCount: 1,
        throwUnhandled: false,
        writeOnFileSystem: false,
        logLevel: "off",
        format,
        formatOutputOptions,
      })

      return bundleToCompilationResult(bundle, {
        projectPathname,
        compileIntoRelativePath,
        entryRelativePath: sourceRelativePath,
        sourcemapPath,
        sourcemapAssetPath: computeSourcemapAssetPath(compileRelativePath),
      })
    },
  })
}

const computeSourcemapAssetPath = (compileRelativePath) => {
  const entryBasename = basename(compileRelativePath)
  const sourcemapPath = `./${entryBasename}__asset__/${entryBasename}.map`
  return sourcemapPath
}
