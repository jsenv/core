/*
 * see https://github.com/davewasmer/devcert/blob/master/src/platforms/win32.ts
 * https://docs.microsoft.com/en-us/windows-server/administration/windows-commands/certutil
 */

import { createDetailedMessage, UNICODE } from "@jsenv/humanize";
import { fileURLToPath } from "node:url";
import { exec } from "../exec.js";
import {
  VERB_ADD_TRUST,
  VERB_CHECK_TRUST,
  VERB_ENSURE_TRUST,
  VERB_REMOVE_TRUST,
} from "../trust_query.js";

const REASON_NEW_AND_TRY_TO_TRUST_DISABLED =
  "certificate is new and tryToTrust is disabled";
const REASON_NOT_FOUND_IN_WINDOWS = "not found in windows store";
const REASON_FOUND_IN_WINDOWS = "found in windows store";
const REASON_ADD_COMMAND_FAILED =
  "command to add certificate to windows store failed";
const REASON_ADD_COMMAND_COMPLETED =
  "command to add certificate to windows store completed";
const REASON_DELETE_COMMAND_FAILED =
  "command to remove certificate from windows store failed";
const REASON_DELETE_COMMAND_COMPLETED =
  "command to remove certificate from windows store completed";

export const executeTrustQueryOnWindows = async ({
  logger,
  certificateCommonName,
  certificateFileUrl,
  certificateIsNew,
  // certificate,
  verb,
}) => {
  if (verb === VERB_CHECK_TRUST && certificateIsNew) {
    logger.info(`${UNICODE.INFO} You should add certificate to windows`);
    return {
      status: "not_trusted",
      reason: REASON_NEW_AND_TRY_TO_TRUST_DISABLED,
    };
  }

  logger.info(`Check if certificate is in windows...`);
  // https://docs.microsoft.com/en-us/windows-server/administration/windows-commands/certutil#-viewstore
  // TODO: check if -viewstore works better than -store
  const certutilListCommand = `certutil -store -user root`;
  logger.debug(`${UNICODE.COMMAND} ${certutilListCommand}`);
  const certutilListCommandOutput = await exec(certutilListCommand);
  const certificateFilePath = fileURLToPath(certificateFileUrl);

  // it's not super accurate and do not take into account if the cert is different
  // but it's the best I could do with certutil command on windows
  const certificateInStore = certutilListCommandOutput.includes(
    certificateCommonName,
  );
  if (!certificateInStore) {
    logger.info(`${UNICODE.INFO} certificate not found in windows`);
    if (verb === VERB_CHECK_TRUST || verb === VERB_REMOVE_TRUST) {
      return {
        status: "not_trusted",
        reason: REASON_NOT_FOUND_IN_WINDOWS,
      };
    }

    // https://docs.microsoft.com/en-us/windows-server/administration/windows-commands/certutil#-addstore
    const certutilAddCommand = `certutil -addstore -user root "${certificateFilePath}"`;
    logger.info(`Adding certificate to windows...`);
    logger.info(`${UNICODE.COMMAND} ${certutilAddCommand}`);
    try {
      await exec(certutilAddCommand);
      logger.info(`${UNICODE.OK} certificate added to windows`);
      return {
        status: "trusted",
        reason: REASON_ADD_COMMAND_COMPLETED,
      };
    } catch (e) {
      logger.error(
        createDetailedMessage(
          `${UNICODE.FAILURE} Failed to add certificate to windows`,
          {
            "error stack": e.stack,
            "certificate file": certificateFilePath,
          },
        ),
      );
      return {
        status: "not_trusted",
        reason: REASON_ADD_COMMAND_FAILED,
      };
    }
  }

  logger.info(`${UNICODE.OK} certificate found in windows`);
  if (
    verb === VERB_CHECK_TRUST ||
    verb === VERB_ADD_TRUST ||
    verb === VERB_ENSURE_TRUST
  ) {
    return {
      status: "trusted",
      reason: REASON_FOUND_IN_WINDOWS,
    };
  }

  // https://docs.microsoft.com/en-us/windows-server/administration/windows-commands/certutil#-delstore
  const certutilRemoveCommand = `certutil -delstore -user root "${certificateCommonName}"`;
  logger.info(`Removing certificate from windows...`);
  logger.info(`${UNICODE.COMMAND} ${certutilRemoveCommand}`);
  try {
    await exec(certutilRemoveCommand);
    logger.info(`${UNICODE.OK} certificate removed from windows`);
    return {
      status: "not_trusted",
      reason: REASON_DELETE_COMMAND_COMPLETED,
    };
  } catch (e) {
    logger.error(
      createDetailedMessage(
        `${UNICODE.FAILURE} failed to remove certificate from windows`,
        {
          "error stack": e.stack,
          "certificate file": certificateFilePath,
        },
      ),
    );
    return {
      status: "unknown", // maybe it was not trusted?
      reason: REASON_DELETE_COMMAND_FAILED,
    };
  }
};
