import { extname, dirname, basename } from "path"
import { bundleBrowser } from "../bundle/browser/bundleBrowser.js"
import { bundleNode } from "../bundle/node/bundleNode.js"
import { serveCompiledFile } from "../compiled-file-service/index.js"
import { platformClientBundleToCompilationResult } from "./platformClientBundleToCompilationResult.js"
import { pathnameToOperatingSystemFilename } from "../operating-system-filename.js"

export const serveBundle = async ({
  projectPathname,
  compileIntoRelativePath,
  importMapRelativePath,
  sourceRelativePath,
  compileRelativePath,
  sourcemapRelativePath = computeSourcemapRelativePath(compileRelativePath),
  babelConfigMap,
  headers,
  inlineSpecifierMap = {},
  format = "system",
}) => {
  return serveCompiledFile({
    projectPathname,
    headers,
    sourceRelativePath,
    compileRelativePath: `${compileIntoRelativePath}${compileRelativePath}`,
    compile: async () => {
      const entryExtname = extname(sourceRelativePath)
      const entryBasename = basename(sourceRelativePath, entryExtname)
      const entryDirname = dirname(sourceRelativePath)
      const entryName = entryBasename

      if (entryDirname) {
        compileIntoRelativePath = `${compileIntoRelativePath}/${entryDirname}`
      }

      const entryPointMap = {
        [entryName]: sourceRelativePath,
      }

      const generateBundle = format === "cjs" ? bundleNode : bundleBrowser

      const bundle = await generateBundle({
        projectFolder: pathnameToOperatingSystemFilename(projectPathname),
        bundleIntoRelativePath: compileIntoRelativePath,
        importMapRelativePath,
        entryPointMap,
        inlineSpecifierMap,
        babelConfigMap,
        format,
        compileGroupCount: 1,
        throwUnhandled: false,
        writeOnFileSystem: false,
        logLevel: "off",
      })

      return platformClientBundleToCompilationResult({
        projectPathname,
        compileIntoRelativePath,
        sourceRelativePath,
        sourcemapRelativePath,
        inlineSpecifierMap,
        bundle,
      })
    },
  })
}

const computeSourcemapRelativePath = (compileRelativePath) => {
  const entryBasename = basename(compileRelativePath)
  const sourcemapRelativePath = `/${entryBasename}__asset__/${entryBasename}.map`
  return sourcemapRelativePath
}
