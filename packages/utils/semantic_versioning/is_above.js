import { compareTwoVersions } from "./compare_versions.js"

export const versionIsAbove = (versionSupposedAbove, versionSupposedBelow) => {
  return compareTwoVersions(versionSupposedAbove, versionSupposedBelow) > 0
}
