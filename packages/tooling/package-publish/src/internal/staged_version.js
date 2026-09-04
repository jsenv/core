/*
 * A version lands on the registry in two steps: the registry takes the tarball
 * ("staged"), then it exposes the version. While a version is staged the
 * registry answers 409 'Cannot publish over previously staged version "x.y.z"'
 * to any publish of it, so waiting for it to be exposed is the only way through.
 *
 * The packument says nothing about a staged version, but its tarball is already
 * served: that is what tells a staged version apart from one that was never
 * published.
 */

import { createTaskLog } from "@jsenv/humanize";

export const VERSION_STATUS = {
  ABSENT: "absent",
  STAGED: "staged",
  PUBLISHED: "published",
};

const STAGED_VERSION_TIMEOUT_MS = 300_000;
const STAGED_VERSION_POLL_INTERVAL_MS = 5_000;

export const checkVersionStatusInRegistry = async ({
  registryUrl,
  packageName,
  packageVersion,
  token,
}) => {
  const versionIsInRegistry = await checkVersionIsInRegistry({
    registryUrl,
    packageName,
    packageVersion,
    token,
  });
  if (versionIsInRegistry) {
    return VERSION_STATUS.PUBLISHED;
  }
  const tarballIsInRegistry = await checkTarballIsInRegistry({
    registryUrl,
    packageName,
    packageVersion,
    token,
  });
  if (tarballIsInRegistry) {
    return VERSION_STATUS.STAGED;
  }
  return VERSION_STATUS.ABSENT;
};

export const waitForStagedVersionToLand = async ({
  registryUrl,
  packageName,
  packageVersion,
  token,
}) => {
  const waitTask = createTaskLog(
    `wait for ${packageName}@${packageVersion} to be published by ${registryUrl}`,
  );
  const msBeforeTimeout = Date.now() + STAGED_VERSION_TIMEOUT_MS;
  try {
    while (true) {
      const versionIsInRegistry = await checkVersionIsInRegistry({
        registryUrl,
        packageName,
        packageVersion,
        token,
      });
      if (versionIsInRegistry) {
        waitTask.done();
        return;
      }
      if (Date.now() > msBeforeTimeout) {
        throw new Error(
          `${packageName}@${packageVersion} is staged on ${registryUrl} but did not get published. Run the publish again to keep waiting; a staged version cannot be published again.`,
        );
      }
      await new Promise((resolve) => {
        setTimeout(resolve, STAGED_VERSION_POLL_INTERVAL_MS);
      });
    }
  } catch (e) {
    waitTask.fail();
    throw e;
  }
};

const checkVersionIsInRegistry = async ({
  registryUrl,
  packageName,
  packageVersion,
  token,
}) => {
  const response = await fetchRegistry(`${registryUrl}/${packageName}`, {
    method: "GET",
    token,
  });
  if (!response || response.status !== 200) {
    return false;
  }
  const packageObject = await response.json();
  return Boolean(packageObject.versions[packageVersion]);
};

const checkTarballIsInRegistry = async ({
  registryUrl,
  packageName,
  packageVersion,
  token,
}) => {
  const response = await fetchRegistry(
    computeTarballUrl({ registryUrl, packageName, packageVersion }),
    { method: "HEAD", token },
  );
  return Boolean(response) && response.status === 200;
};

const computeTarballUrl = ({ registryUrl, packageName, packageVersion }) => {
  const packageBasename =
    packageName[0] === "@"
      ? packageName.slice(packageName.indexOf("/") + 1)
      : packageName;
  return `${registryUrl}/${packageName}/-/${packageBasename}-${packageVersion}.tgz`;
};

const fetchRegistry = async (url, { method, token }) => {
  try {
    return await fetch(url, {
      method,
      headers: {
        "accept":
          "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*",
        // the registry is served by a cache; without this a version can stay
        // invisible long after it landed
        "cache-control": "no-cache",
        ...(token ? { authorization: `token ${token}` } : {}),
      },
    });
  } catch {
    // a network hiccup is one more reason for the version not to be there yet
    return null;
  }
};
