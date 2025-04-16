/*
 * NSS DB stands for Network Security Service DataBase
 * Certutil command documentation: https://developer.mozilla.org/en-US/docs/Mozilla/Projects/NSS/tools/NSS_Tools_certutil
 */

import {
  assertAndNormalizeDirectoryUrl,
  collectFiles,
} from "@jsenv/filesystem";
import { createDetailedMessage, UNICODE } from "@jsenv/humanize";
import { urlToFilename } from "@jsenv/urls";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { detectBrowser } from "./browser_detection.js";
import { exec } from "./exec.js";
import { searchCertificateInCommandOutput } from "./search_certificate_in_command_output.js";
import {
  VERB_ADD_TRUST,
  VERB_CHECK_TRUST,
  VERB_ENSURE_TRUST,
} from "./trust_query.js";

export const executeTrustQueryOnBrowserNSSDB = async ({
  logger,
  certificateCommonName,
  certificateFileUrl,
  certificateIsNew,
  certificate,

  verb,
  NSSDynamicInstall,
  nssCommandName,
  detectIfNSSIsInstalled,
  getNSSDynamicInstallInfo,
  getCertutilBinPath,

  browserName,
  browserPaths,
  browserNSSDBDirectoryUrls,
  getBrowserClosedPromise,
}) => {
  logger.debug(`Detecting ${browserName}...`);

  const browserDetected = detectBrowser(browserPaths);
  if (!browserDetected) {
    logger.debug(`${UNICODE.INFO} ${browserName} not detected`);
    return {
      status: "other",
      reason: `${browserName} not detected`,
    };
  }
  logger.debug(`${UNICODE.OK} ${browserName} detected`);

  if (verb === VERB_CHECK_TRUST && certificateIsNew) {
    logger.info(`${UNICODE.INFO} You should add certificate to ${browserName}`);
    return {
      status: "not_trusted",
      reason: "certificate is new and tryToTrust is disabled",
    };
  }

  logger.info(`Check if certificate is in ${browserName}...`);
  const nssIsInstalled = await detectIfNSSIsInstalled({ logger });
  const cannotCheckMessage = `${UNICODE.FAILURE} cannot check if certificate is in ${browserName}`;
  if (!nssIsInstalled) {
    if (verb === VERB_ADD_TRUST || verb === VERB_ENSURE_TRUST) {
      const nssDynamicInstallInfo = await getNSSDynamicInstallInfo({ logger });
      if (!nssDynamicInstallInfo.isInstallable) {
        const reason = `"${nssCommandName}" is not installed and not cannot be installed`;
        logger.warn(
          createDetailedMessage(cannotCheckMessage, {
            reason,
            "reason it cannot be installed":
              nssDynamicInstallInfo.notInstallableReason,
            "suggested solution": nssDynamicInstallInfo.suggestion,
          }),
        );
        return {
          status: "unknown",
          reason,
        };
      }

      if (!NSSDynamicInstall) {
        const reason = `"${nssCommandName}" is not installed and NSSDynamicInstall is false`;
        logger.warn(
          createDetailedMessage(cannotCheckMessage, {
            reason,
            "suggested solution": `Allow "${nssCommandName}" dynamic install with NSSDynamicInstall: true`,
          }),
        );
        return {
          status: "unknown",
          reason,
        };
      }

      try {
        await nssDynamicInstallInfo.install({ logger });
      } catch (e) {
        logger.error(
          createDetailedMessage(cannotCheckMessage, {
            "reason": `error while trying to install "${nssCommandName}"`,
            "error stack": e.stack,
          }),
        );
        return {
          status: "unknown",
          reason: `"${nssCommandName}" installation failed`,
        };
      }
    } else {
      const reason = `"${nssCommandName}" is not installed`;
      logger.info(
        createDetailedMessage(cannotCheckMessage, {
          reason,
        }),
      );
      return {
        status: "unknown",
        reason,
      };
    }
  }

  let NSSDBFiles;
  for (const browserNSSDBDirectoryUrl of browserNSSDBDirectoryUrls) {
    NSSDBFiles = await findNSSDBFiles({
      logger,
      NSSDBDirectoryUrl: browserNSSDBDirectoryUrl,
    });
    if (NSSDBFiles.length > 0) {
      break;
    }
  }

  const fileCount = NSSDBFiles.length;
  if (fileCount === 0) {
    const reason = `could not find nss database file`;
    logger.warn(createDetailedMessage(cannotCheckMessage), { reason });
    return {
      status: "unknown",
      reason,
    };
  }

  const certificateFilePath = fileURLToPath(certificateFileUrl);
  const certutilBinPath = await getCertutilBinPath();

  const checkNSSDB = async ({ NSSDBFileUrl }) => {
    const directoryArg = getDirectoryArgFromNSSDBFileUrl(NSSDBFileUrl);
    const certutilListCommand = `${certutilBinPath} -L -a -d ${directoryArg} -n "${certificateCommonName}"`;
    logger.debug(`Checking if certificate is in nss database...`);
    logger.debug(`${UNICODE.COMMAND} ${certutilListCommand}`);
    try {
      const output = await execCertutilCommmand(certutilListCommand);
      const isInDatabase = searchCertificateInCommandOutput(
        output,
        certificate,
      );
      if (isInDatabase) {
        return "found";
      }
      return "outdated";
    } catch (e) {
      if (isCertificateNotFoundError(e)) {
        return "missing";
      }
      throw e;
    }
  };

  const addToNSSDB = async ({ NSSDBFileUrl }) => {
    const directoryArg = getDirectoryArgFromNSSDBFileUrl(NSSDBFileUrl);
    const certutilAddCommand = `${certutilBinPath} -A -d ${directoryArg} -t C,, -i "${certificateFilePath}" -n "${certificateCommonName}"`;
    logger.debug(`Adding certificate to nss database...`);
    logger.debug(`${UNICODE.COMMAND} ${certutilAddCommand}`);
    await execCertutilCommmand(certutilAddCommand);
    logger.debug(`${UNICODE.OK} certificate added to nss database`);
  };

  const removeFromNSSDB = async ({ NSSDBFileUrl }) => {
    const directoryArg = getDirectoryArgFromNSSDBFileUrl(NSSDBFileUrl);
    const certutilRemoveCommand = `${certutilBinPath} -D -d ${directoryArg} -t C,, -i "${certificateFilePath}" -n "${certificateCommonName}"`;
    logger.debug(`Removing certificate from nss database...`);
    logger.debug(`${UNICODE.COMMAND} ${certutilRemoveCommand}`);
    await execCertutilCommmand(certutilRemoveCommand);
    logger.debug(`${UNICODE.OK} certificate removed from nss database`);
  };

  const missings = [];
  const outdateds = [];
  const founds = [];
  await Promise.all(
    NSSDBFiles.map(async (NSSDBFileUrl) => {
      const certificateStatus = await checkNSSDB({ NSSDBFileUrl });

      if (certificateStatus === "missing") {
        logger.debug(`${UNICODE.INFO} certificate not found in nss database`);
        missings.push(NSSDBFileUrl);
        return;
      }

      if (certificateStatus === "outdated") {
        outdateds.push(NSSDBFileUrl);
        return;
      }

      logger.debug(`${UNICODE.OK} certificate found in nss database`);
      founds.push(NSSDBFileUrl);
    }),
  );

  const missingCount = missings.length;
  const outdatedCount = outdateds.length;
  const foundCount = founds.length;

  if (verb === VERB_CHECK_TRUST) {
    if (missingCount > 0 || outdatedCount > 0) {
      logger.info(`${UNICODE.INFO} certificate not found in ${browserName}`);
      return {
        status: "not_trusted",
        reason: `missing or outdated in ${browserName} nss database file`,
      };
    }
    logger.info(`${UNICODE.OK} certificate found in ${browserName}`);
    return {
      status: "trusted",
      reason: `found in ${browserName} nss database file`,
    };
  }

  if (verb === VERB_ADD_TRUST || verb === VERB_ENSURE_TRUST) {
    if (missingCount === 0 && outdatedCount === 0) {
      logger.info(`${UNICODE.OK} certificate found in ${browserName}`);
      return {
        status: "trusted",
        reason: `found in all ${browserName} nss database file`,
      };
    }
    logger.info(`${UNICODE.INFO} certificate not found in ${browserName}`);
    logger.info(`Adding certificate to ${browserName}...`);
    await getBrowserClosedPromise();
    await Promise.all(
      missings.map(async (missing) => {
        await addToNSSDB({ NSSDBFileUrl: missing });
      }),
    );
    await Promise.all(
      outdateds.map(async (outdated) => {
        await removeFromNSSDB({ NSSDBFileUrl: outdated });
        await addToNSSDB({ NSSDBFileUrl: outdated });
      }),
    );
    logger.info(`${UNICODE.OK} certificate added to ${browserName}`);
    return {
      status: "trusted",
      reason: `added to ${browserName} nss database file`,
    };
  }

  if (outdatedCount === 0 && foundCount === 0) {
    logger.info(`${UNICODE.INFO} certificate not found in ${browserName}`);
    return {
      status: "not_trusted",
      reason: `not found in ${browserName} nss database file`,
    };
  }
  logger.info(`${UNICODE.INFO} found certificate in ${browserName}`);
  logger.info(`Removing certificate from ${browserName}...`);
  await getBrowserClosedPromise();
  await Promise.all(
    outdateds.map(async (outdated) => {
      await removeFromNSSDB({ NSSDBFileUrl: outdated });
    }),
  );
  await Promise.all(
    founds.map(async (found) => {
      await removeFromNSSDB({ NSSDBFileUrl: found });
    }),
  );
  logger.info(`${UNICODE.OK} certificate removed from ${browserName}`);
  return {
    status: "not_trusted",
    reason: `removed from ${browserName} nss database file`,
  };
};

const isCertificateNotFoundError = (error) => {
  if (error.message.includes("could not find certificate named")) {
    return true;
  }
  if (error.message.includes("PR_FILE_NOT_FOUND_ERROR")) {
    return true;
  }
  return false;
};

const NSSDirectoryCache = {};
const findNSSDBFiles = async ({ logger, NSSDBDirectoryUrl }) => {
  NSSDBDirectoryUrl = String(NSSDBDirectoryUrl);
  const resultFromCache = NSSDirectoryCache[NSSDBDirectoryUrl];
  if (resultFromCache) {
    return resultFromCache;
  }

  logger.debug(`Searching nss database files in directory...`);
  const NSSDBDirectoryPath = fileURLToPath(NSSDBDirectoryUrl);
  const NSSDBDirectoryExists = existsSync(NSSDBDirectoryPath);
  if (!NSSDBDirectoryExists) {
    logger.info(
      `${UNICODE.INFO} nss database directory not found on filesystem at ${NSSDBDirectoryPath}`,
    );
    NSSDirectoryCache[NSSDBDirectoryUrl] = [];
    return [];
  }
  NSSDBDirectoryUrl = assertAndNormalizeDirectoryUrl(NSSDBDirectoryUrl);
  const NSSDBFiles = await collectFiles({
    directoryUrl: NSSDBDirectoryUrl,
    associations: {
      isLegacyNSSDB: { "./**/cert8.db": true },
      isModernNSSDB: { "./**/cert9.db": true },
    },
    predicate: ({ isLegacyNSSDB, isModernNSSDB }) =>
      isLegacyNSSDB || isModernNSSDB,
  });
  const fileCount = NSSDBFiles.length;
  if (fileCount === 0) {
    logger.warn(
      `${UNICODE.WARNING} could not find nss database file in ${NSSDBDirectoryUrl}`,
    );
    NSSDirectoryCache[NSSDBDirectoryUrl] = [];
    return [];
  }

  logger.debug(
    `${UNICODE.OK} found ${fileCount} nss database file in ${NSSDBDirectoryUrl}`,
  );
  const files = NSSDBFiles.map((file) => {
    return new URL(file.relativeUrl, NSSDBDirectoryUrl).href;
  });
  NSSDirectoryCache[NSSDBDirectoryUrl] = files;
  return files;
};

const getDirectoryArgFromNSSDBFileUrl = (NSSDBFileUrl) => {
  const nssDBFilename = urlToFilename(NSSDBFileUrl);
  const nssDBDirectoryUrl = new URL("./", NSSDBFileUrl).href;
  const nssDBDirectoryPath = fileURLToPath(nssDBDirectoryUrl);
  return nssDBFilename === "cert8.db"
    ? `"${nssDBDirectoryPath}"`
    : `sql:"${nssDBDirectoryPath}"`;
};

const execCertutilCommmand = async (command) => {
  const output = await exec(command);
  return output;
};
