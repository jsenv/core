import { removeEntry } from "@jsenv/filesystem";
import { createTaskLog } from "@jsenv/humanize";
import { exec } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setNpmConfig } from "./set_npm_config.js";

export const publish = async ({
  logger,
  packageSlug,
  logNpmPublishOutput,
  rootDirectoryUrl,
  registryUrl,
  token,
}) => {
  const publishTask = createTaskLog(`publish ${packageSlug} on ${registryUrl}`);
  try {
    // process.env.NODE_AUTH_TOKEN
    const previousValue = process.env.NODE_AUTH_TOKEN;
    const restoreProcessEnv = () => {
      process.env.NODE_AUTH_TOKEN = previousValue;
    };
    process.env.NODE_AUTH_TOKEN = token;
    // updating package.json to publish on the correct registry
    let restorePackageFile = () => {};
    const rootPackageFileUrl = new URL("./package.json", rootDirectoryUrl);
    const rootPackageFileContent = readFileSync(rootPackageFileUrl);
    const packageObject = JSON.parse(String(rootPackageFileContent));
    const { publishConfig } = packageObject;
    const registerUrlFromPackage = publishConfig
      ? publishConfig.registry || "https://registry.npmjs.org"
      : "https://registry.npmjs.org";
    if (registryUrl !== registerUrlFromPackage) {
      restorePackageFile = () =>
        writeFileSync(rootPackageFileUrl, rootPackageFileContent);
      packageObject.publishConfig = packageObject.publishConfig || {};
      packageObject.publishConfig.registry = registryUrl;
      writeFileSync(
        rootPackageFileUrl,
        JSON.stringify(packageObject, null, "  "),
      );
    }
    // updating .npmrc to add the token
    const npmConfigFileUrl = new URL("./.npmrc", rootDirectoryUrl);
    let restoreNpmConfigFile;
    let npmConfigFileContent;
    try {
      npmConfigFileContent = String(readFileSync(npmConfigFileUrl));
      restoreNpmConfigFile = () =>
        writeFileSync(npmConfigFileUrl, npmConfigFileContent);
    } catch (e) {
      if (e.code === "ENOENT") {
        restoreNpmConfigFile = () => removeEntry(npmConfigFileUrl);
        npmConfigFileContent = "";
      } else {
        throw e;
      }
    }
    writeFileSync(
      npmConfigFileUrl,
      setNpmConfig(npmConfigFileContent, {
        [computeRegistryTokenKey(registryUrl)]: token,
        [computeRegistryKey(packageObject.name)]: registryUrl,
      }),
    );
    try {
      const publishResult = await new Promise((resolve, reject) => {
        const command = exec(
          "npm publish --no-workspaces",
          {
            cwd: fileURLToPath(rootDirectoryUrl),
            stdio: "silent",
          },
          (error) => {
            if (error) {
              // publish conflict generally occurs because servers
              // returns 200 after npm publish
              // but returns previous version if asked immediatly
              // after for the last published version.

              // TODO: ideally we should catch 404 error returned from npm
              // it happens it the token is not allowed to publish
              // a repository. And when we detect this we display a more useful message
              // suggesting the token rights are insufficient to publish the package

              // npm publish conclit
              if (error.message.includes("EPUBLISHCONFLICT")) {
                resolve({
                  success: true,
                  reason: "already-published",
                });
              } else if (
                error.message.includes("Cannot publish over existing version")
              ) {
                resolve({
                  success: true,
                  reason: "already-published",
                });
              } else if (
                error.message.includes(
                  "You cannot publish over the previously published versions",
                )
              ) {
                resolve({
                  success: true,
                  reason: "already-published",
                });
              } else if (error.message.includes("previously staged version")) {
                // The registry accepted a tarball for that version (from a run
                // interrupted before npm confirmed, or one whose PUT it took
                // without exposing the version yet) and refuses any further
                // publish of it until it becomes visible. The publish did go
                // through, so wait for the version to land.
                resolve(
                  waitForStagedVersionToLand({
                    logger,
                    registryUrl,
                    packageName: packageObject.name,
                    packageVersion: packageObject.version,
                    token,
                  }).then(() => ({
                    success: true,
                    reason: "already-published",
                  })),
                );
              }
              // github publish conflict
              else if (
                error.message.includes(
                  "ambiguous package version in package.json",
                )
              ) {
                resolve({
                  success: true,
                  reason: "already-published",
                });
              } else {
                reject(error);
              }
            } else {
              resolve({
                success: true,
                reason: "published",
              });
            }
          },
        );
        if (logNpmPublishOutput) {
          command.stdout.on("data", (data) => {
            logger.debug(data);
          });
          command.stderr.on("data", (data) => {
            // debug because this output is part of
            // the error message generated by a failing npm publish
            logger.debug(data);
          });
        }
      });
      if (publishResult.reason === "already-published") {
        publishTask.setRightText(`(already published)`);
      }
      publishTask.done();
      return publishResult;
    } finally {
      restoreProcessEnv();
      restorePackageFile();
      restoreNpmConfigFile();
    }
  } catch (e) {
    publishTask.fail();
    console.error(e.stack);
    return {
      success: false,
      reason: e,
    };
  }
};

const computeRegistryTokenKey = (registryUrl) => {
  if (registryUrl.startsWith("http://")) {
    return `${registryUrl.slice("http:".length)}/:_authToken`;
  }
  if (registryUrl.startsWith("https://")) {
    return `${registryUrl.slice("https:".length)}/:_authToken`;
  }
  if (registryUrl.startsWith("//")) {
    return `${registryUrl}/:_authToken`;
  }
  throw new Error(
    `registryUrl must start with http or https, got ${registryUrl}`,
  );
};

const computeRegistryKey = (packageName) => {
  if (packageName[0] === "@") {
    const packageScope = packageName.slice(0, packageName.indexOf("/"));
    return `${packageScope}:registry`;
  }
  return `registry`;
};

// A version becomes available in two steps: npm stages it, then the registry
// makes it visible. While it is staged the registry answers 409 to a publish of
// that same version, and once staged that version can never be published again,
// so waiting for it is the only way through.
const STAGED_VERSION_TIMEOUT_MS = 120_000;
const STAGED_VERSION_POLL_INTERVAL_MS = 5_000;

const waitForStagedVersionToLand = async ({
  logger,
  registryUrl,
  packageName,
  packageVersion,
  token,
}) => {
  logger.info(
    `${packageName}@${packageVersion} is staged on ${registryUrl}, waiting for the registry to publish it`,
  );
  const msBeforeTimeout = Date.now() + STAGED_VERSION_TIMEOUT_MS;
  while (true) {
    const versionIsInRegistry = await checkVersionInRegistry({
      registryUrl,
      packageName,
      packageVersion,
      token,
    });
    if (versionIsInRegistry) {
      return;
    }
    if (Date.now() > msBeforeTimeout) {
      throw new Error(
        `${packageName}@${packageVersion} is staged on ${registryUrl} but did not get published. Bump the version, a staged version cannot be published again.`,
      );
    }
    await new Promise((resolve) => {
      setTimeout(resolve, STAGED_VERSION_POLL_INTERVAL_MS);
    });
  }
};

const checkVersionInRegistry = async ({
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
        // the registry is served by a cache; without this the version can stay
        // invisible long after it landed
        "cache-control": "no-cache",
        ...(token
          ? {
              authorization: `token ${token}`,
            }
          : {}),
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
