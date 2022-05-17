import {
  assertAndNormalizeDirectoryUrl,
  urlIsInsideOf,
  moveUrl,
  ensureWindowsDriveLetter,
} from "@jsenv/filesystem"

import { commonJsToJsModuleRaw } from "./cjs_to_esm_raw.js"
import { reuseOrCreateCompiledFile } from "./compile_cache/compiled_file_cache.js"

export const commonJsToJsModule = ({
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
      sourceFileUrl,
      compiledFileUrl,
      compile: () => {
        return commonJsToJsModuleRaw({
          rootDirectoryUrl,
          sourceFileUrl,
          compiledFileUrl,
          ...rest,
        })
      },
    })
  }
  return commonJsToJsModuleRaw({
    rootDirectoryUrl,
    sourceFileUrl,
    ...rest,
  })
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
