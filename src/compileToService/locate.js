import { locateModuleFilename, pathnameToFileHref } from "@jsenv/module-resolution"

export const locate = ({ projectFolder, compileInto, refererPathname, requestPathname }) => {
  const moduleInfo = pathnameToCompileIdAndFileNameRelative({
    compileInto,
    pathname: requestPathname,
  })

  if (!moduleInfo.filenameRelative || !moduleInfo.compileId) return {}

  const importerInfo = refererPathname
    ? pathnameToCompileIdAndFileNameRelative({
        compileInto,
        pathname: refererPathname,
      })
    : {}
  const sourceOrigin = pathnameToFileHref(projectFolder)

  // with import map, we will no longer need locateModuleFilename
  // at least it could be simplified and node module resolution
  // could be removed from it
  const filename = locateModuleFilename({
    sourceOrigin,
    moduleFilenameRelative: moduleInfo.filenameRelative,
    importerFilenameRelative: importerInfo.filenameRelative,
  })

  return {
    compileId: importerInfo.compileId || moduleInfo.compileId,
    filename,
  }
}

const pathnameToCompileIdAndFileNameRelative = ({ compileInto, pathname }) => {
  if (pathname.startsWith(`/${compileInto}/`) === false) {
    return {
      compileId: null,
      filenameRelative: null,
    }
  }

  const afterCompileInto = pathname.slice(`/${compileInto}/`.length)
  const parts = afterCompileInto.split("/")

  const compileId = parts[0]
  if (compileId.length === 0) {
    return {
      compileId: null,
      filenameRelative: null,
    }
  }

  const filenameRelative = parts.slice(1).join("/")
  if (filenameRelative.length === 0) {
    return {
      compileId: null,
      filenameRelative,
    }
  }

  return {
    compileId,
    filenameRelative,
  }
}
