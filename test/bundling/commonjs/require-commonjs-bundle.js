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
  return { namespace: normalizedNamespace(namespace) }
}

const normalizedNamespace = (namespace) => {
  const normalized = {}
  // remove "__esModule" from values
  Object.keys(namespace).forEach((key) => {
    normalized[key] = namespace[key]
  })
  return normalized
}
