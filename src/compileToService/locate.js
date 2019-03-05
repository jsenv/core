import { locateModuleFilename, pathnameToFileHref } from "@jsenv/module-resolution"

export const locate = ({ projectFolder, refererPathname, requestPathname }) => {
  const moduleFilenameRelative = requestPathname.slice(1)
  const importerFilenameRelative = refererPathname ? refererPathname.slice(1) : null
  const sourceOrigin = pathnameToFileHref(projectFolder)

  const filename = locateModuleFilename({
    sourceOrigin,
    moduleFilenameRelative,
    importerFilenameRelative,
  })

  return {
    filename,
  }
}
