/*
 * Whether the registry exposes a version, and waiting until it does.
 *
 * A version the registry accepted is not exposed right away: npm holds it
 * ("staged") for minutes, sometimes hours. Nothing read from the registry tells
 * a staged version apart from one that was never published, the packument
 * ignores it and its tarball is a 404.
 */

import { createTaskLog } from "@jsenv/humanize";

const POLL_INTERVAL_MS = 5_000;

export const waitForVersionInRegistry = async ({
  registryUrl,
  packageName,
  packageVersion,
  token,
  timeout,
  timeoutErrorMessage,
}) => {
  const waitTask = createTaskLog(
    `wait for ${packageName}@${packageVersion} to be published by ${registryUrl}`,
  );
  const msBeforeTimeout = Date.now() + timeout;
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
        throw new Error(timeoutErrorMessage);
      }
      await new Promise((resolve) => {
        setTimeout(resolve, POLL_INTERVAL_MS);
      });
    }
  } catch (e) {
    waitTask.fail();
    throw e;
  }
};

export const checkVersionIsInRegistry = async ({
  registryUrl,
  packageName,
  packageVersion,
  token,
}) => {
  let response;
  try {
    response = await fetch(`${registryUrl}/${packageName}`, {
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
    return false;
  }
  if (response.status !== 200) {
    return false;
  }
  const packageObject = await response.json();
  return Boolean(packageObject.versions[packageVersion]);
};
