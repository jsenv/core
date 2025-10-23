import { writeFileSync } from "@jsenv/filesystem";
import { UNICODE, createDetailedMessage, createLogger } from "@jsenv/humanize";
import { readFileSync } from "node:fs";
import { getAuthorityFileInfos } from "./internal/authority_file_infos.js";
import { requestCertificateFromAuthority } from "./internal/certificate_generator.js";
import { forge } from "./internal/forge.js";
import { formatDuration } from "./internal/validity_formatting.js";
import {
  createValidityDurationOfXDays,
  verifyServerCertificateValidityDuration,
} from "./validity_duration.js";

export const requestCertificate = ({
  logLevel,
  logger = createLogger({ logLevel }), // to be able to catch logs during unit tests

  altNames = ["localhost"],
  commonName = "https local server certificate",
  validityDurationInMs = createValidityDurationOfXDays(396),
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
npx @jsenv/https-local install --trust`,
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

  return {
    certificate: serverCertificate,
    privateKey: serverCertificatePrivateKey,
    rootCertificateFilePath: rootCertificateFileInfo.path,
  };
};
