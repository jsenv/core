import { readFileSync } from "node:fs"
import {
  assertAndNormalizeDirectoryUrl,
  urlIsInsideOf,
  moveUrl,
  ensureWindowsDriveLetter,
} from "@jsenv/filesystem"

import { setUrlExtension } from "@jsenv/utils/urls/url_utils.js"
import { commonJsToJsModuleRaw } from "./cjs_to_esm_raw.js"
import { reuseOrCreateCompiledFile } from "./compile_cache/compiled_file_cache.js"

export const commonJsToJsModule = ({
  logLevel,
  filesystemCache = true,
  rootDirectoryUrl,
  sourceFileUrl,
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
}) => {
  if (!urlIsInsideOf(url, rootDirectoryUrl)) {
    const fsRootUrl = ensureWindowsDriveLetter("file:///", url)
    url = `${rootDirectoryUrl}@fs/${url.slice(fsRootUrl.length)}`
  }
  return moveUrl({
    url,
    from: rootDirectoryUrl,
    to: compileDirectoryUrl,
    preferAbsolute: true,
  })
}
