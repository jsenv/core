import { compareTwoVersions } from "./compare_versions.js"

export const versionIsBelow = (versionSupposedBelow, versionSupposedAbove) => {
  return compareTwoVersions(versionSupposedBelow, versionSupposedAbove) < 0
}
