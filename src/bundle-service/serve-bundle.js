import { extname, dirname, basename } from "path"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { bundleBrowser } from "../bundle/browser/bundleBrowser.js"
import { bundleNode } from "../bundle/node/bundleNode.js"
import { serveCompiledFile } from "../compiled-file-service/index.js"
import { platformClientBundleToCompilationResult } from "./platformClientBundleToCompilationResult.js"

export const serveBundle = async ({
  projectPathname,
  compileIntoRelativePath,
  importMapRelativePath,
  sourceRelativePath,
  compileRelativePath,
  sourcemapRelativePath = computeSourcemapRelativePath(compileRelativePath),
  babelPluginMap,
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
      const bundleIntoRelativePath = entryDirname
        ? `${compileIntoRelativePath}${entryDirname}`
        : compileIntoRelativePath
      const entryPointMap = {
        [entryName]: sourceRelativePath,
      }

      const generateBundle = format === "cjs" ? bundleNode : bundleBrowser
      const bundle = await generateBundle({
        projectPath: pathnameToOperatingSystemPath(projectPathname),
        bundleIntoRelativePath,
        importMapRelativePath,
        entryPointMap,
        inlineSpecifierMap,
        babelPluginMap,
        format,
        compileGroupCount: 1,
        throwUnhandled: false,
        writeOnFileSystem: false,
        logLevel: "off",
      })

      return platformClientBundleToCompilationResult({
        projectPathname,
        compileIntoRelativePath,
        inlineSpecifierMap,
        entryRelativePath: sourceRelativePath,
        sourcemapRelativePath,
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
