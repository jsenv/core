import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// https://github.com/npm/node-semver#readme
const {
  gt: versionGreaterThan,
  prerelease: versionToPrerelease,
} = require("semver");

export const PUBLISH_BECAUSE_NEVER_PUBLISHED = "never-published";
export const PUBLISH_BECAUSE_LATEST_LOWER = "latest-lower";
export const PUBLISH_BECAUSE_TAG_DIFFERS = "tag-differs";

export const NOTHING_BECAUSE_LATEST_HIGHER = "latest-higher";
export const NOTHING_BECAUSE_ALREADY_PUBLISHED = "already-published";

export const needsPublish = ({ registryLatestVersion, packageVersion }) => {
  if (registryLatestVersion === null) {
    return PUBLISH_BECAUSE_NEVER_PUBLISHED;
  }
  if (registryLatestVersion === packageVersion) {
    return NOTHING_BECAUSE_ALREADY_PUBLISHED;
  }
  if (versionGreaterThan(registryLatestVersion, packageVersion)) {
    return NOTHING_BECAUSE_LATEST_HIGHER;
  }
  const registryLatestVersionPrerelease = versionToPrerelease(
    registryLatestVersion,
  );
  const packageVersionPrerelease = versionToPrerelease(packageVersion);
  if (
    registryLatestVersionPrerelease === null &&
    packageVersionPrerelease === null
  ) {
    return PUBLISH_BECAUSE_LATEST_LOWER;
  }
  if (
    registryLatestVersionPrerelease === null &&
    packageVersionPrerelease !== null
  ) {
    return PUBLISH_BECAUSE_LATEST_LOWER;
  }
  if (
    registryLatestVersionPrerelease !== null &&
    packageVersionPrerelease === null
  ) {
    return PUBLISH_BECAUSE_LATEST_LOWER;
  }
  const [registryReleaseTag, registryPrereleaseVersion] =
    registryLatestVersionPrerelease;
  const [packageReleaseTag, packagePreReleaseVersion] =
    packageVersionPrerelease;
  if (registryReleaseTag !== packageReleaseTag) {
    return PUBLISH_BECAUSE_TAG_DIFFERS;
  }
  if (registryPrereleaseVersion === packagePreReleaseVersion) {
    return NOTHING_BECAUSE_ALREADY_PUBLISHED;
  }
  if (registryPrereleaseVersion > packagePreReleaseVersion) {
    return NOTHING_BECAUSE_LATEST_HIGHER;
  }
  return PUBLISH_BECAUSE_LATEST_LOWER;
};
