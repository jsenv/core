import { locateModuleFilename, pathnameToFileHref } from "@jsenv/module-resolution"

export const locate = ({ projectFolder, compileInto, requestPathname, requestReferer }) => {
  const {
    compileId: moduleCompileId,
    filenameRelative: moduleFilenameRelative,
  } = pathnameToCompileIdAndFileNameRelative(requestPathname, compileInto)

  if (!moduleCompileId) return {}
  if (!moduleFilenameRelative) return {}

  const {
    compileId: importerCompileId,
    filenameRelative: importerFilenameRelative,
  } = pathnameToCompileIdAndFileNameRelative(requestReferer, compileInto)

  const moduleFilename = locateModuleFilename({
    sourceOrigin: pathnameToFileHref(projectFolder),
    moduleFilenameRelative,
    importerFilenameRelative,
  })

  if (!moduleFilename.startsWith(projectFolder)) {
    throw createModuleOutsideProjectError({
      projectFolder,
      filename: moduleFilename,
    })
  }

  return {
    // compileId of the importer overrides moduleCompileId
    // so that an instrumented importer also instruments what it imports
    compileId: importerCompileId || moduleCompileId,
    filenameRelative: moduleFilename.slice(projectFolder.length),
    filename: moduleFilename,
  }
}

const pathnameToCompileIdAndFileNameRelative = (requestPathname = "", compileInto) => {
  if (requestPathname.startsWith(`${compileInto}/`) === false) {
    return {
      compileId: null,
      filenameRelative: null,
    }
  }

  const afterCompileInto = requestPathname.slice(`${compileInto}/`.length)
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

const createModuleOutsideProjectError = ({ projectFolder, filename }) => {
  return new Error(`module cannot be outside project.
projectFolder: ${projectFolder}
filename: ${filename}`)
}
