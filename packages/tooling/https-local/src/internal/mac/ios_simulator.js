/*
 * iOS simulators have a trust store of their own: a certificate trusted by the
 * mac keychain is still refused by Safari (and by fetch) inside a simulator.
 * Xcode's `simctl keychain <device> add-root-cert` writes the certificate into
 * the trust store of a booted simulator with an empty trust settings array,
 * which Apple reads as "trust as root for every policy" — no toggle in
 * Settings › General › About › Certificate Trust Settings afterwards.
 *
 * simctl cannot list or remove trusted roots ("reset" wipes the whole keychain),
 * so membership is read from the simulator's trust store database, where
 * certificates are keyed by their fingerprint, with the sqlite3 binary
 * shipped with macOS.
 */

import { createDetailedMessage, UNICODE } from "@jsenv/humanize";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { commandExists } from "../command.js";
import { exec } from "../exec.js";
import { forge } from "../forge.js";
import {
  VERB_ADD_TRUST,
  VERB_CHECK_TRUST,
  VERB_ENSURE_TRUST,
  VERB_REMOVE_TRUST,
} from "../trust_query.js";

const REASON_SIMCTL_NOT_AVAILABLE = "xcrun simctl not available";
const REASON_NO_BOOTED_SIMULATOR = "no booted iOS simulator";
const REASON_NEW_AND_TRY_TO_TRUST_DISABLED =
  "certificate is new and tryToTrust is disabled";
const REASON_NOT_IN_SIMULATOR = "certificate not found in iOS simulator";
const REASON_IN_SIMULATOR = "certificate found in iOS simulator";
const REASON_TRUST_STORE_UNREADABLE =
  "cannot read the iOS simulator trust store";
const REASON_ADD_TO_SIMULATOR_COMMAND_FAILED =
  "command to add certificate in iOS simulator failed";
const REASON_ADD_TO_SIMULATOR_COMMAND_COMPLETED =
  "command to add certificate in iOS simulator completed";
const REASON_CANNOT_REMOVE_FROM_SIMULATOR =
  "certificate cannot be removed from iOS simulator";

export const executeTrustQueryOnIosSimulator = async ({
  logger,
  certificateFileUrl,
  certificateIsNew,
  certificate,
  verb,
}) => {
  const certificateFilePath = fileURLToPath(certificateFileUrl);
  const { simctlAvailable, bootedSimulators } = await listBootedIosSimulators({
    logger,
  });
  if (!simctlAvailable) {
    return {
      status: "other",
      reason: REASON_SIMCTL_NOT_AVAILABLE,
    };
  }
  if (bootedSimulators.length === 0) {
    if (verb === VERB_ADD_TRUST || verb === VERB_ENSURE_TRUST) {
      logger.info(
        `${UNICODE.INFO} no booted iOS simulator, to trust the certificate in one boot it and re-run, or run:
${UNICODE.COMMAND} xcrun simctl keychain booted add-root-cert "${certificateFilePath}"`,
      );
    } else {
      logger.debug(`${UNICODE.INFO} no booted iOS simulator`);
    }
    return {
      status: "other",
      reason: REASON_NO_BOOTED_SIMULATOR,
    };
  }
  if (verb === VERB_CHECK_TRUST && certificateIsNew) {
    logger.info(`${UNICODE.INFO} You should add certificate to iOS simulator`);
    return {
      status: "not_trusted",
      reason: REASON_NEW_AND_TRY_TO_TRUST_DISABLED,
    };
  }

  const fingerprints = getCertificateFingerprints(certificate);
  const results = [];
  for (const simulator of bootedSimulators) {
    results.push(
      await executeTrustQueryOnOneSimulator({
        logger,
        simulator,
        certificateFilePath,
        fingerprints,
        verb,
      }),
    );
  }
  // one entry stands for all booted simulators: the first one not trusted, if any
  const notTrustedResult = results.find(
    (result) => result.status !== "trusted",
  );
  return notTrustedResult || results[0];
};

/**
 * Booted simulators as reported by simctl.
 * simctlAvailable is false when Xcode is not installed: /usr/bin/xcrun then
 * exists but has no simctl to run.
 */
export const listBootedIosSimulators = async ({ logger } = {}) => {
  const xcrunExists = await commandExists("xcrun");
  if (!xcrunExists) {
    return { simctlAvailable: false, bootedSimulators: [] };
  }
  const listCommand = `xcrun simctl list devices booted -j`;
  if (logger) {
    logger.debug(`${UNICODE.COMMAND} ${listCommand}`);
  }
  let listCommandOutput;
  try {
    listCommandOutput = await exec(listCommand);
  } catch {
    return { simctlAvailable: false, bootedSimulators: [] };
  }
  const { devices } = JSON.parse(listCommandOutput);
  const bootedSimulators = [];
  for (const runtime of Object.keys(devices)) {
    for (const device of devices[runtime]) {
      bootedSimulators.push({
        udid: device.udid,
        name: device.name,
        dataPath: device.dataPath,
      });
    }
  }
  return { simctlAvailable: true, bootedSimulators };
};

const executeTrustQueryOnOneSimulator = async ({
  logger,
  simulator,
  certificateFilePath,
  fingerprints,
  verb,
}) => {
  const simulatorLabel = `iOS simulator "${simulator.name}"`;

  logger.info(`Check if certificate is in ${simulatorLabel}...`);
  const found = await findCertificateInSimulatorTrustStore({
    logger,
    simulator,
    fingerprints,
  });

  const addCert = async () => {
    const addRootCertCommand = `xcrun simctl keychain ${simulator.udid} add-root-cert "${certificateFilePath}"`;
    logger.info(`Adding certificate to ${simulatorLabel}...`);
    logger.info(`${UNICODE.COMMAND} ${addRootCertCommand}`);
    try {
      await exec(addRootCertCommand);
      logger.info(`${UNICODE.OK} certificate added to ${simulatorLabel}`);
      return {
        status: "trusted",
        reason: REASON_ADD_TO_SIMULATOR_COMMAND_COMPLETED,
      };
    } catch (e) {
      logger.error(
        createDetailedMessage(
          `${UNICODE.FAILURE} failed to add certificate to ${simulatorLabel}`,
          {
            "error stack": e.stack,
            "certificate file": certificateFilePath,
          },
        ),
      );
      return {
        status: "not_trusted",
        reason: REASON_ADD_TO_SIMULATOR_COMMAND_FAILED,
      };
    }
  };

  if (found === null) {
    logger.info(
      `${UNICODE.INFO} cannot check if certificate is in ${simulatorLabel}`,
    );
    if (verb === VERB_ADD_TRUST || verb === VERB_ENSURE_TRUST) {
      // add-root-cert replaces an existing entry, so adding blindly is safe
      return addCert();
    }
    return {
      status: "unknown",
      reason: REASON_TRUST_STORE_UNREADABLE,
    };
  }

  if (!found) {
    logger.info(`${UNICODE.INFO} certificate not found in ${simulatorLabel}`);
    if (verb === VERB_CHECK_TRUST || verb === VERB_REMOVE_TRUST) {
      return {
        status: "not_trusted",
        reason: REASON_NOT_IN_SIMULATOR,
      };
    }
    return addCert();
  }

  logger.info(`${UNICODE.OK} certificate found in ${simulatorLabel}`);
  if (verb === VERB_REMOVE_TRUST) {
    logger.info(
      `${UNICODE.INFO} certificate stays in ${simulatorLabel}: simctl cannot remove a single root certificate, "xcrun simctl keychain ${simulator.udid} reset" wipes the whole simulator keychain`,
    );
    return {
      status: "trusted",
      reason: REASON_CANNOT_REMOVE_FROM_SIMULATOR,
    };
  }
  return {
    status: "trusted",
    reason: REASON_IN_SIMULATOR,
  };
};

// Relative to the simulator data directory. The first one is where trustd keeps
// the store on current runtimes (checked on iOS 26), the second is the location
// of older runtimes. The table keys certificates by sha256 on current runtimes,
// by sha1 on older ones.
const TRUST_STORE_RELATIVE_PATHS = [
  "private/var/protected/trustd/private/TrustStore.sqlite3",
  "Library/Keychains/TrustStore.sqlite3",
];

/**
 * true/false when the trust store answers, null when it cannot be read
 * (sqlite3 missing, unexpected layout).
 * A simulator where no root certificate was ever added has no store file,
 * which means "not found".
 */
const findCertificateInSimulatorTrustStore = async ({
  logger,
  simulator,
  fingerprints,
}) => {
  const trustStorePath = TRUST_STORE_RELATIVE_PATHS.map(
    (relativePath) => `${simulator.dataPath}/${relativePath}`,
  ).find((path) => existsSync(path));
  if (!trustStorePath) {
    return false;
  }
  const sqlite3Exists = await commandExists("sqlite3");
  if (!sqlite3Exists) {
    logger.debug(`${UNICODE.INFO} sqlite3 not found`);
    return null;
  }
  for (const [column, fingerprint] of [
    ["sha256", fingerprints.sha256],
    ["sha1", fingerprints.sha1],
  ]) {
    const selectCommand = `sqlite3 -readonly "${trustStorePath}" "select hex(${column}) from tsettings"`;
    logger.debug(`${UNICODE.COMMAND} ${selectCommand}`);
    let selectCommandOutput;
    try {
      selectCommandOutput = await exec(selectCommand);
    } catch {
      continue;
    }
    const storedFingerprints = selectCommandOutput
      .split("\n")
      .map((line) => line.trim().toUpperCase());
    return storedFingerprints.includes(fingerprint);
  }
  logger.debug(
    `${UNICODE.INFO} unexpected trust store layout at ${trustStorePath}`,
  );
  return null;
};

const getCertificateFingerprints = (certificate) => {
  const { pki, asn1 } = forge;
  const certificateForgeObject = pki.certificateFromPem(certificate);
  const der = asn1
    .toDer(pki.certificateToAsn1(certificateForgeObject))
    .getBytes();
  const derBuffer = Buffer.from(der, "binary");
  return {
    sha256: createHash("sha256").update(derBuffer).digest("hex").toUpperCase(),
    sha1: createHash("sha1").update(derBuffer).digest("hex").toUpperCase(),
  };
};
