import {
  operatingSystemPathToPathname,
  pathnameToOperatingSystemPath,
} from "@jsenv/operating-system-path"

export const requireCommonJsBundle = async ({
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
