import { writeFileSync } from "@jsenv/filesystem";
import { UNICODE, createDetailedMessage, createLogger } from "@jsenv/humanize";
import { readFileSync } from "node:fs";
import { hostname as osHostname, networkInterfaces } from "node:os";
import { getAuthorityFileInfos } from "./internal/authority_file_infos.js";
import { requestCertificateFromAuthority } from "./internal/certificate_generator.js";
import { addCertificateToProcessCACertificates } from "./internal/process_ca_certificates.js";
import { forge } from "./internal/forge.js";
import { formatDuration } from "./internal/validity_formatting.js";
import {
  createValidityDurationOfXDays,
  verifyServerCertificateValidityDuration,
} from "./validity_duration.js";

/**
 * Generates a server certificate signed by the local certificate authority, which
 * `npx @jsenv/https-local init` installs once per machine. A fresh certificate on each
 * call, returned in memory: call it on every server start.
 *
 * @param {Object} [params]
 * @param {Array<string>} [params.altNames] - Hostnames and ips the certificate is valid
 *   for. Defaults to every name of the machine, read at the time of the call: `localhost`,
 *   `127.0.0.1`, `::1`, the machine name, `<name>.local` and the network ips.
 * @param {string} [params.commonName="https local server certificate"]
 * @param {number} [params.validityDurationInMs] - 396 days by default; above 397 days,
 *   the most browsers accept, it is capped with a warning.
 * @param {boolean} [params.trustAuthority=true] - Make the current process trust the
 *   authority, see `trustCertificateAuthority`.
 * @param {string} [params.logLevel]
 *
 * @returns {{ certificate: string, privateKey: string, rootCertificate: string, rootCertificateFilePath: string }}
 *   PEM strings. `rootCertificate` is the authority, for a device that must trust it; its
 *   private key is never returned.
 */
export const requestCertificate = ({
  logLevel,
  logger = createLogger({ logLevel }), // to be able to catch logs during unit tests

  altNames = getMachineAltNames(),
  commonName = "https local server certificate",
  validityDurationInMs = createValidityDurationOfXDays(396),
  trustAuthority = true,
} = {}) => {
  if (typeof validityDurationInMs !== "number") {
    throw new TypeError(
      `validityDurationInMs must be a number but received ${validityDurationInMs}`,
    );
  }
  if (validityDurationInMs < 1) {
    throw new TypeError(
      `validityDurationInMs must be > 0 but received ${validityDurationInMs}`,
    );
  }
  const validityDurationInfo =
    verifyServerCertificateValidityDuration(validityDurationInMs);
  if (!validityDurationInfo.ok) {
    validityDurationInMs = validityDurationInfo.maxAllowedValue;
    logger.warn(
      createDetailedMessage(validityDurationInfo.message, {
        details: validityDurationInfo.details,
      }),
    );
  }

  const {
    authorityJsonFileInfo,
    rootCertificateFileInfo,
    rootCertificatePrivateKeyFileInfo,
  } = getAuthorityFileInfos();
  if (!rootCertificateFileInfo.exists) {
    throw new Error(
      `Certificate authority not found, "installCertificateAuthority" must be called before "requestServerCertificate".
--- Suggested command to run ---
npx @jsenv/https-local init`,
    );
  }
  if (!rootCertificatePrivateKeyFileInfo.exists) {
    throw new Error(`Cannot find authority root certificate private key`);
  }
  if (!authorityJsonFileInfo.exists) {
    throw new Error(`Cannot find authority json file`);
  }

  logger.debug(`Restoring certificate authority from filesystem...`);
  const { pki } = forge;
  const rootCertificate = String(
    readFileSync(new URL(rootCertificateFileInfo.url)),
  );
  const rootCertificatePrivateKey = String(
    readFileSync(new URL(rootCertificatePrivateKeyFileInfo.url)),
  );
  const certificateAuthorityData = JSON.parse(
    String(readFileSync(new URL(authorityJsonFileInfo.url))),
  );
  const rootCertificateForgeObject = pki.certificateFromPem(rootCertificate);
  const rootCertificatePrivateKeyForgeObject = pki.privateKeyFromPem(
    rootCertificatePrivateKey,
  );
  logger.debug(`${UNICODE.OK} certificate authority restored from filesystem`);

  const serverCertificateSerialNumber =
    certificateAuthorityData.serialNumber + 1;
  writeFileSync(
    authorityJsonFileInfo.url,
    JSON.stringify({ serialNumber: serverCertificateSerialNumber }, null, "  "),
  );

  logger.debug(`Generating server certificate...`);
  const { certificateForgeObject, certificatePrivateKeyForgeObject } =
    requestCertificateFromAuthority({
      authorityCertificateForgeObject: rootCertificateForgeObject,
      auhtorityCertificatePrivateKeyForgeObject:
        rootCertificatePrivateKeyForgeObject,
      serialNumber: serverCertificateSerialNumber,
      altNames,
      commonName,
      validityDurationInMs,
    });
  const serverCertificate = pki.certificateToPem(certificateForgeObject);
  const serverCertificatePrivateKey = pki.privateKeyToPem(
    certificatePrivateKeyForgeObject,
  );
  logger.debug(
    `${
      UNICODE.OK
    } server certificate generated, it will be valid for ${formatDuration(
      validityDurationInMs,
    )}`,
  );

  if (trustAuthority) {
    addCertificateToProcessCACertificates({
      logger,
      certificate: rootCertificate,
      certificateFilePath: rootCertificateFileInfo.path,
    });
  }

  return {
    certificate: serverCertificate,
    privateKey: serverCertificatePrivateKey,
    rootCertificate,
    rootCertificateFilePath: rootCertificateFileInfo.path,
  };
};

// Every name this machine can be reached at: a name missing from the
// certificate fails in the browser even once the authority is trusted, and a
// phone reaches the machine by its network ip or its mDNS name.
const getMachineAltNames = () => {
  const altNameSet = new Set(["localhost", "127.0.0.1", "::1"]);
  const machineName = osHostname();
  altNameSet.add(machineName);
  if (!machineName.endsWith(".local")) {
    altNameSet.add(`${machineName}.local`);
  }
  for (const addresses of Object.values(networkInterfaces())) {
    for (const { address, internal } of addresses) {
      if (!internal) {
        altNameSet.add(address);
      }
    }
  }
  return Array.from(altNameSet);
};
