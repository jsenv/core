// https://ss64.com/osx/security.html

import { createDetailedMessage, UNICODE } from "@jsenv/humanize";
import { fileURLToPath } from "node:url";
import { exec } from "../exec.js";
import { searchCertificateInCommandOutput } from "../search_certificate_in_command_output.js";
import {
  VERB_ADD_TRUST,
  VERB_CHECK_TRUST,
  VERB_ENSURE_TRUST,
  VERB_REMOVE_TRUST,
} from "../trust_query.js";

const REASON_NEW_AND_TRY_TO_TRUST_DISABLED =
  "certificate is new and tryToTrust is disabled";
const REASON_NOT_IN_KEYCHAIN = "certificate not found in mac keychain";
const REASON_IN_KEYCHAIN = "certificate found in mac keychain";
const REASON_ADD_TO_KEYCHAIN_COMMAND_FAILED =
  "command to add certificate in mac keychain failed";
const REASON_ADD_TO_KEYCHAIN_COMMAND_COMPLETED =
  "command to add certificate in mac keychain completed";
const REASON_REMOVE_FROM_KEYCHAIN_COMMAND_FAILED =
  "command to remove certificate from mac keychain failed";
const REASON_REMOVE_FROM_KEYCHAIN_COMMAND_COMPLETED =
  "command to remove certificate from mac keychain completed";

const systemKeychainPath = "/Library/Keychains/System.keychain";

export const executeTrustQueryOnMacKeychain = async ({
  logger,
  certificateCommonName,
  certificateFileUrl,
  certificateIsNew,
  certificate,
  verb,
}) => {
  if (verb === VERB_CHECK_TRUST && certificateIsNew) {
    logger.info(`${UNICODE.INFO} You should add certificate to mac keychain`);
    return {
      status: "not_trusted",
      reason: REASON_NEW_AND_TRY_TO_TRUST_DISABLED,
    };
  }

  logger.info(`Check if certificate is in mac keychain...`);
  // https://ss64.com/osx/security-find-cert.html
  const findCertificateCommand = `security find-certificate -a -p ${systemKeychainPath}`;
  logger.debug(`${UNICODE.COMMAND} ${findCertificateCommand}`);
  const findCertificateCommandOutput = await exec(findCertificateCommand);
  const certificateFoundInCommandOutput = searchCertificateInCommandOutput(
    findCertificateCommandOutput,
    certificate,
  );

  const removeCert = async () => {
    // https://ss64.com/osx/security-delete-cert.html
    const removeTrustedCertCommand = `sudo security delete-certificate -c "${certificateCommonName}"`;
    logger.info(`Removing certificate from mac keychain...`);
    logger.info(`${UNICODE.COMMAND} ${removeTrustedCertCommand}`);
    try {
      await exec(removeTrustedCertCommand);
      logger.info(`${UNICODE.OK} certificate removed from mac keychain`);
      return {
        status: "not_trusted",
        reason: REASON_REMOVE_FROM_KEYCHAIN_COMMAND_COMPLETED,
      };
    } catch (e) {
      logger.error(
        createDetailedMessage(
          `${UNICODE.FAILURE} failed to remove certificate from mac keychain`,
          {
            "error stack": e.stack,
            "certificate file url": certificateFileUrl,
          },
        ),
      );
      return {
        status: "not_trusted",
        reason: REASON_REMOVE_FROM_KEYCHAIN_COMMAND_FAILED,
      };
    }
  };

  if (!certificateFoundInCommandOutput) {
    logger.info(`${UNICODE.INFO} certificate not found in mac keychain`);
    if (verb === VERB_CHECK_TRUST || verb === VERB_REMOVE_TRUST) {
      return {
        status: "not_trusted",
        reason: REASON_NOT_IN_KEYCHAIN,
      };
    }
    if (verb === VERB_ENSURE_TRUST) {
      // It seems possible for certificate PEM representation to be different
      // in mackeychain and in the one we have written on the filesystem
      // When it happens the certificate is not found but actually exists on mackeychain
      // and must be deleted first
      await removeCert();
    }
    const certificateFilePath = fileURLToPath(certificateFileUrl);
    // https://ss64.com/osx/security-cert.html
    const addTrustedCertCommand = `sudo security add-trusted-cert -d -r trustRoot -k ${systemKeychainPath} "${certificateFilePath}"`;
    logger.info(`Adding certificate to mac keychain...`);
    logger.info(`${UNICODE.COMMAND} ${addTrustedCertCommand}`);
    try {
      await exec(addTrustedCertCommand);
      logger.info(`${UNICODE.OK} certificate added to mac keychain`);
      return {
        status: "trusted",
        reason: REASON_ADD_TO_KEYCHAIN_COMMAND_COMPLETED,
      };
    } catch (e) {
      logger.error(
        createDetailedMessage(
          `${UNICODE.FAILURE} failed to add certificate to mac keychain`,
          {
            "error stack": e.stack,
            "certificate file": certificateFilePath,
          },
        ),
      );
      return {
        status: "not_trusted",
        reason: REASON_ADD_TO_KEYCHAIN_COMMAND_FAILED,
      };
    }
  }

  // being in the keychain do not guarantee certificate is trusted
  // people can still manually untrust the root cert
  // but they shouldn't and I couldn't find an API to know if the cert is trusted or not
  // just if it's in the keychain
  logger.info(`${UNICODE.OK} certificate found in mac keychain`);
  if (
    verb === VERB_CHECK_TRUST ||
    verb === VERB_ADD_TRUST ||
    verb === VERB_ENSURE_TRUST
  ) {
    return {
      status: "trusted",
      reason: REASON_IN_KEYCHAIN,
    };
  }

  return removeCert();
};
