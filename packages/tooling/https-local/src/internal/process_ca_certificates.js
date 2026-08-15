/*
 * Browsers trust the authority root certificate because it is installed in the
 * system keychain; node ignores that keychain and uses its own CA list, so a
 * node process fetching a local https server signed by the authority fails with
 * "unable to verify the first certificate".
 *
 * Only the authority root certificate is added: reading the whole system
 * keychain (tls.getCACertificates("system")) would also pull in whatever a
 * corporate proxy installed there.
 */

import { UNICODE, createDetailedMessage } from "@jsenv/humanize";
import tls from "node:tls";

export const addCertificateToProcessCACertificates = ({
  logger,
  certificate,
  certificateFilePath,
}) => {
  // named imports would make the whole package fail to link on node versions
  // where these functions do not exist yet
  const { getCACertificates, setDefaultCACertificates } = tls;
  if (!getCACertificates || !setDefaultCACertificates) {
    logger.warn(
      createDetailedMessage(
        `Cannot trust certificate authority: "tls.setDefaultCACertificates" is not available in node ${process.version} (available starting from node 22.19.0 and 24.5.0).`,
        {
          "suggested workaround": `start the process with NODE_EXTRA_CA_CERTS, it must be set before the process starts`,
          "suggested command to run": `NODE_EXTRA_CA_CERTS="${certificateFilePath}" node file.mjs`,
        },
      ),
    );
    return false;
  }

  const defaultCertificates = getCACertificates("default");
  const alreadyTrusted = defaultCertificates.some((defaultCertificate) => {
    return isSameCertificate(defaultCertificate, certificate);
  });
  if (alreadyTrusted) {
    logger.debug(
      `${UNICODE.OK} authority root certificate already trusted by this process`,
    );
    return false;
  }
  setDefaultCACertificates([...defaultCertificates, certificate]);
  logger.debug(
    `${UNICODE.OK} authority root certificate trusted by this process`,
  );
  return true;
};

const isSameCertificate = (a, b) => {
  return toCertificateBody(a) === toCertificateBody(b);
};

// PEM files describing the very same certificate differ by their line wrapping
// and trailing newlines
const toCertificateBody = (certificate) => {
  return certificate
    .replace(/-----(BEGIN|END) CERTIFICATE-----/g, "")
    .replace(/\s/g, "");
};
