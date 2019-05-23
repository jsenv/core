import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"

// for now node bundle use require
// they may move to systemjs to support top level await

export const importNodeBundle = async ({ bundleFolder, file }) => {
  const namespace = import.meta.require(pathnameToOperatingSystemPath(`${bundleFolder}/${file}`))
  return { namespace }
}
