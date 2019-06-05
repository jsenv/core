import {
  operatingSystemPathToPathname,
  pathnameToOperatingSystemPath,
} from "@jsenv/operating-system-path"

export const nodeRequireGlobalBundle = async ({
  projectPath,
  bundleIntoRelativePath,
  mainRelativePath,
  globalName,
}) => {
  const projectPathname = operatingSystemPathToPathname(projectPath)
  const mainPathname = `${projectPathname}${bundleIntoRelativePath}${mainRelativePath}`
  const mainPath = pathnameToOperatingSystemPath(mainPathname)
  import.meta.require(mainPath)
  return { globalValue: global[globalName] }
}
