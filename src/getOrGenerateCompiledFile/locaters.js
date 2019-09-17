import { pathnameToDirname } from "@jsenv/href"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"

export const getCacheFilePath = ({
  projectPathname,
  compileCacheFolderRelativePath,
  compileRelativePath,
}) =>
  pathnameToOperatingSystemPath(
    `${projectPathname}${compileCacheFolderRelativePath}${compileRelativePath}__asset__/cache.json`,
  )

// the fact an asset filename is relative to projectPath + compiledpathnameRelative
// is strange considering a source filename is relative to projectPath
// I think it would make more sense to make them relative to the cache.json
// file itself but that's for later
export const getAssetFilePath = ({
  projectPathname,
  compileCacheFolderRelativePath,
  compileRelativePath,
  asset,
}) =>
  pathnameToOperatingSystemPath(
    `${projectPathname}${compileCacheFolderRelativePath}/${pathnameToDirname(
      compileRelativePath.slice(1),
    )}/${asset}`,
  )

export const getCompiledFilePath = ({
  projectPathname,
  compileCacheFolderRelativePath,
  compileRelativePath,
}) =>
  pathnameToOperatingSystemPath(
    `${projectPathname}${compileCacheFolderRelativePath}${compileRelativePath}`,
  )

export const getSourceFilePath = ({ projectPathname, sourceRelativePath }) =>
  pathnameToOperatingSystemPath(`${projectPathname}${sourceRelativePath}`)
