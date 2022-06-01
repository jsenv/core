import { readFileSync } from "node:fs"
import {
  assertAndNormalizeDirectoryUrl,
  urlIsInsideOf,
  moveUrl,
  ensureWindowsDriveLetter,
  urlToExtension,
  urlToBasename,
} from "@jsenv/filesystem"

import { setUrlExtension, setUrlFilename } from "@jsenv/utils/urls/url_utils.js"
import { commonJsToJsModuleRaw } from "./cjs_to_esm_raw.js"
import { reuseOrCreateCompiledFile } from "./compile_cache/compiled_file_cache.js"

export const commonJsToJsModule = ({
  logLevel,
  filesystemCache = true,
  rootDirectoryUrl,
  sourceFileUrl,
  processEnvNodeEnv,
  ...rest
}) => {
  if (filesystemCache) {
    rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl)
    const compileDirectoryUrl = new URL(
      "./.jsenv/cjs_to_esm/",
      rootDirectoryUrl,
    )
    const compiledFileUrl = determineCompiledFileUrl({
      url: sourceFileUrl,
      rootDirectoryUrl,
      compileDirectoryUrl,
      processEnvNodeEnv,
    })

    return reuseOrCreateCompiledFile({
      logLevel,
      compileDirectoryUrl,
      sourceFileUrl,
      compiledFileUrl,
      compile: async () => {
        const { content, sourcemap } = await commonJsToJsModuleRaw({
          logLevel,
          rootDirectoryUrl,
          sourceFileUrl,
          processEnvNodeEnv,
          ...rest,
        })
        const assets = extractCompileAssets({
          sourceUrl: sourceFileUrl,
          sourceContent: String(readFileSync(new URL(sourceFileUrl))),
          compiledUrl: compiledFileUrl,
          compiledContent: content,
          sourcemap,
        })
        return {
          content,
          sourcemap,
          assets,
        }
      },
    })
  }
  return commonJsToJsModuleRaw({
    logLevel,
    rootDirectoryUrl,
    sourceFileUrl,
    ...rest,
  })
}

const extractCompileAssets = ({
  sourceUrl,
  sourceContent,
  compiledUrl,
  sourcemap,
}) => {
  const compileAssets = {}

  // ensure the source file is part of sources no matter what
  // it covers cases where sourcemap.sources is empty
  // or do not contain the real source file
  // there is a check to prevent duplicate sources in case the sourcemap is correct and contains
  // the source file in sourcemap.sources
  compileAssets[sourceUrl] = { type: "source", content: sourceContent }
  if (sourcemap) {
    sourcemap.sources.forEach((source, index) => {
      if (source.startsWith("file://")) {
        const contentFromSourcemap = sourcemap.sourcesContent
          ? sourcemap.sourcesContent[index]
          : null
        const content =
          contentFromSourcemap || String(readFileSync(new URL(source)))
        compileAssets[source] = { type: "source", content }
      }
    })
    const sourcemapUrl = setUrlExtension(compiledUrl, ".map")
    const sourcemapContent = JSON.stringify(sourcemap)
    compileAssets[sourcemapUrl] = {
      type: "sourcemap",
      content: sourcemapContent,
    }
  }

  return compileAssets
}

const determineCompiledFileUrl = ({
  url,
  rootDirectoryUrl,
  compileDirectoryUrl,
  processEnvNodeEnv,
}) => {
  if (!urlIsInsideOf(url, rootDirectoryUrl)) {
    const fsRootUrl = ensureWindowsDriveLetter("file:///", url)
    url = `${rootDirectoryUrl}@fs/${url.slice(fsRootUrl.length)}`
  }
  if (processEnvNodeEnv) {
    const basename = urlToBasename(url)
    const extension = urlToExtension(url)
    url = setUrlFilename(url, `${basename}.${processEnvNodeEnv}${extension}`)
  }
  return moveUrl({
    url,
    from: rootDirectoryUrl,
    to: compileDirectoryUrl,
    preferAbsolute: true,
  })
}
