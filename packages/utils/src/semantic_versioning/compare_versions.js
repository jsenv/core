import { versionFromValue } from "./version_from_value.js";

export const compareTwoVersions = (versionA, versionB) => {
  const semanticVersionA = versionFromValue(versionA);
  const semanticVersionB = versionFromValue(versionB);
  const majorDiff = semanticVersionA.major - semanticVersionB.major;
  if (majorDiff > 0) {
    return majorDiff;
  }
  if (majorDiff < 0) {
    return majorDiff;
  }
  const minorDiff = semanticVersionA.minor - semanticVersionB.minor;
  if (minorDiff > 0) {
    return minorDiff;
  }
  if (minorDiff < 0) {
    return minorDiff;
  }
  const patchDiff = semanticVersionA.patch - semanticVersionB.patch;
  if (patchDiff > 0) {
    return patchDiff;
  }
  if (patchDiff < 0) {
    return patchDiff;
  }
  return 0;
};
