import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem";
import { createLogger } from "@jsenv/humanize";
import { fetchLatestInRegistry } from "./internal/fetch_latest_in_registry.js";
import {
  needsPublish,
  NOTHING_BECAUSE_ALREADY_PUBLISHED,
  NOTHING_BECAUSE_LATEST_HIGHER,
  PUBLISH_BECAUSE_LATEST_LOWER,
  PUBLISH_BECAUSE_NEVER_PUBLISHED,
  PUBLISH_BECAUSE_TAG_DIFFERS,
} from "./internal/needs_publish.js";
import { publish } from "./internal/publish.js";
import { readProjectPackage } from "./internal/read_project_package.js";

export const publishPackage = async ({
  logLevel,
  rootDirectoryUrl,
  registriesConfig,
  logNpmPublishOutput = true,
  updateProcessExitCode = true,
} = {}) => {
  const logger = createLogger({ logLevel });
  logger.debug(
    `publishPackage(${JSON.stringify(
      { rootDirectoryUrl, logLevel, registriesConfig },
      null,
      "  ",
    )})`,
  );
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl);
  assertRegistriesConfig(registriesConfig);

  logger.debug(`reading project package.json`);
  const packageInProject = readProjectPackage({ rootDirectoryUrl });

  const { name: packageName, version: packageVersion } = packageInProject;
  logger.info(`${packageName}@${packageVersion} found in package.json`);

  const report = {};
  await Promise.all(
    Object.keys(registriesConfig).map(async (registryUrl) => {
      const registryReport = {
        packageName,
        packageVersion,
        registryLatestVersion: undefined,
        action: undefined,
        actionReason: undefined,
        actionResult: undefined,
      };
      report[registryUrl] = registryReport;

      if (packageInProject.private) {
        registryReport.action = "nothing";
        registryReport.actionReason = "package is private";
        return;
      }

      logger.debug(`check latest version for ${packageName} in ${registryUrl}`);
      const registryConfig = registriesConfig[registryUrl];

      try {
        const latestPackageInRegistry = await fetchLatestInRegistry({
          registryUrl,
          packageName,
          ...registryConfig,
        });
        const registryLatestVersion =
          latestPackageInRegistry === null
            ? null
            : latestPackageInRegistry.version;
        registryReport.registryLatestVersion = registryLatestVersion;

        const needs = needsPublish({ packageVersion, registryLatestVersion });
        registryReport.action =
          needs === PUBLISH_BECAUSE_NEVER_PUBLISHED ||
          needs === PUBLISH_BECAUSE_LATEST_LOWER ||
          needs === PUBLISH_BECAUSE_TAG_DIFFERS
            ? "publish"
            : "nothing";
        registryReport.actionReason = needs;
      } catch (e) {
        registryReport.action = "nothing";
        registryReport.actionReason = e;
        if (updateProcessExitCode) {
          process.exitCode = 1;
        }
      }
    }),
  );

  // we have to publish in serie because we don't fully control
  // npm publish, we have to enforce where the package gets published
  await Object.keys(report).reduce(async (previous, registryUrl) => {
    await previous;

    const registryReport = report[registryUrl];
    const { action, actionReason, registryLatestVersion } = registryReport;

    if (action === "nothing") {
      if (actionReason === NOTHING_BECAUSE_ALREADY_PUBLISHED) {
        logger.info(
          `skip ${packageName}@${packageVersion} publish on ${registryUrl} because already published`,
        );
      } else if (actionReason === NOTHING_BECAUSE_LATEST_HIGHER) {
        logger.info(
          `skip ${packageName}@${packageVersion} publish on ${registryUrl} because latest version is higher (${registryLatestVersion})`,
        );
      } else if (actionReason === "package is private") {
        logger.info(
          `skip ${packageName}@${packageVersion} publish on ${registryUrl} because found private: true in package.json`,
        );
      } else {
        logger.error(`skip ${packageName}@${packageVersion} publish on ${registryUrl} due to error while fetching latest version.
--- error stack ---
${actionReason.stack}`);
      }

      registryReport.actionResult = { success: true, reason: "nothing-to-do" };
      return;
    }

    if (actionReason === PUBLISH_BECAUSE_NEVER_PUBLISHED) {
      logger.info(
        `publish ${packageName}@${packageVersion} on ${registryUrl} because it was never published`,
      );
    } else if (actionReason === PUBLISH_BECAUSE_LATEST_LOWER) {
      logger.info(
        `publish ${packageName}@${packageVersion} on ${registryUrl} because latest version is lower (${registryLatestVersion})`,
      );
    } else if (actionReason === PUBLISH_BECAUSE_TAG_DIFFERS) {
      logger.info(
        `publish ${packageName}@${packageVersion} on ${registryUrl} because latest tag differs (${registryLatestVersion})`,
      );
    }

    const { success, reason } = await publish({
      logger,
      packageSlug: `${packageName}@${packageVersion}`,
      logNpmPublishOutput,
      rootDirectoryUrl,
      registryUrl,
      ...registriesConfig[registryUrl],
    });
    registryReport.actionResult = { success, reason };
    if (!success && updateProcessExitCode) {
      process.exitCode = 1;
    }
  }, Promise.resolve());

  return report;
};

const assertRegistriesConfig = (value) => {
  if (typeof value !== "object" || value === null) {
    throw new TypeError(`registriesConfig must be an object, got ${value}`);
  }

  Object.keys(value).forEach((registryUrl) => {
    const registryMapValue = value[registryUrl];
    if (typeof registryMapValue !== "object" || value === null) {
      throw new TypeError(
        `Unexpected value in registriesConfig for ${registryUrl}. It must be an object, got ${registryMapValue}`,
      );
    }

    if (
      `token` in registryMapValue === false ||
      registryMapValue.token === ""
    ) {
      throw new TypeError(
        `Missing token in registriesConfig for ${registryUrl}.`,
      );
    }

    const { token } = registryMapValue;
    if (typeof token !== "string") {
      throw new TypeError(
        `Unexpected token in registriesConfig for ${registryUrl}. It must be a string, got ${token}.`,
      );
    }
  });
};
