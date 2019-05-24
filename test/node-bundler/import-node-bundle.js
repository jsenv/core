import {
  operatingSystemPathToPathname,
  pathnameToOperatingSystemPath,
} from "@jsenv/operating-system-path"

// for now node bundle use require
// they may move to systemjs to support top level await

export const importNodeBundle = async ({
  projectPath,
  bundleIntoRelativePath,
  mainRelativePath,
}) => {
  const projectPathname = operatingSystemPathToPathname(projectPath)
  const mainPathname = `${projectPathname}${bundleIntoRelativePath}${mainRelativePath}`
  const mainPath = pathnameToOperatingSystemPath(mainPathname)
  const namespace = import.meta.require(mainPath)
  return { namespace }
}
