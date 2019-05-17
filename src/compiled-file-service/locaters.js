import { pathnameToDirname } from "@jsenv/module-resolution"
import { pathnameToOperatingSystemPath } from "../operating-system-path.js"

export const getCacheFilename = ({ projectPathname, compileRelativePath }) =>
  pathnameToOperatingSystemPath(`${projectPathname}${compileRelativePath}__asset__/cache.json`)

// the fact an asset filename is relative to projectFolder + compiledpathnameRelative
// is strange considering a source filename is relative to projectFolder
// I think it would make more sense to make them relative to the cache.json
// file itself but that's for later
export const getAssetFilename = ({ projectPathname, compileRelativePath, asset }) =>
  pathnameToOperatingSystemPath(
    `${projectPathname}/${pathnameToDirname(compileRelativePath.slice(1))}/${asset}`,
  )

export const getCompiledFilename = ({ projectPathname, compileRelativePath }) =>
  pathnameToOperatingSystemPath(`${projectPathname}${compileRelativePath}`)

export const getSourceFilename = ({ projectPathname, sourceRelativePath }) =>
  pathnameToOperatingSystemPath(`${projectPathname}/${sourceRelativePath}`)
