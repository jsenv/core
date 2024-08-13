import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// https://github.com/npm/node-semver#readme
const {
  gt: versionGreaterThan,
  prerelease: versionToPrerelease,
} = require("semver");

export const VERSION_COMPARE_RESULTS = {
  SAME: "same",
  GREATER: "greater",
  SMALLER: "smaller",
  DIFF_TAG: "diff_tag",
};

export const compareTwoPackageVersions = (firstVersion, secondVersion) => {
  if (firstVersion === secondVersion) {
    return VERSION_COMPARE_RESULTS.SAME;
  }
  if (versionGreaterThan(firstVersion, secondVersion)) {
    return VERSION_COMPARE_RESULTS.GREATER;
  }
  const firstVersionPrerelase = versionToPrerelease(firstVersion);
  const secondVersionPrerelease = versionToPrerelease(secondVersion);
  if (firstVersionPrerelase === null && secondVersionPrerelease === null) {
    return VERSION_COMPARE_RESULTS.SMALLER;
  }
  if (firstVersionPrerelase !== null && secondVersionPrerelease === null) {
    return VERSION_COMPARE_RESULTS.SMALLER;
  }
  if (firstVersionPrerelase === null && secondVersionPrerelease !== null) {
    return VERSION_COMPARE_RESULTS.SMALLER;
  }
  const [firstReleaseTag, firstPrereleaseVersion] = firstVersionPrerelase;
  const [secondReleaseTag, secondPrereleaseVersion] = firstVersionPrerelase;
  if (firstReleaseTag !== secondReleaseTag) {
    return VERSION_COMPARE_RESULTS.DIFF_TAG;
  }
  if (firstPrereleaseVersion === secondPrereleaseVersion) {
    return VERSION_COMPARE_RESULTS.SAME;
  }
  if (firstPrereleaseVersion > secondPrereleaseVersion) {
    return VERSION_COMPARE_RESULTS.GREATER;
  }
  return VERSION_COMPARE_RESULTS.SMALLER;
};
